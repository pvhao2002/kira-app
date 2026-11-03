package com.queue.kiraqueue.rest;

import com.queue.kiraqueue.config.BusinessException;
import com.queue.kiraqueue.crawl.DateCrawlService;
import com.queue.kiraqueue.crawl.EventCrawlService;
import com.queue.kiraqueue.dto.aiscore.CrawledMatchBundleDto;
import com.queue.kiraqueue.service.CrawDateServiceV2;
import com.queue.kiraqueue.service.CrawEventServiceV2;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import java.util.regex.Pattern;

/** Thin transport for the browser extension: receives raw AiScore protobuf bytes (base64), decodes/persists. */
@Slf4j
@RestController
@RequestMapping("/ext")
@RequiredArgsConstructor
public class ExtensionCrawlController {
    private static final Pattern DATE = Pattern.compile("\\d{8}");
    private static final Pattern EXTERNAL_ID = Pattern.compile("[A-Za-z0-9_-]{1,64}");
    private static final int LOCK_ATTEMPTS = 3;

    private static final String SQL_CANDIDATES = """
            select e.external_id
            from events e
            where e.link is not null
              and e.has_odds
              and e.status_id in (1, 2, 3, 4)
              and e.event_date >= :from
              and e.event_date < :to
            order by e.event_date, e.event_id
            """;

    private final DateCrawlService dateCrawlService;
    private final EventCrawlService eventCrawlService;
    private final CrawDateServiceV2 crawDateService;
    private final CrawEventServiceV2 crawEventService;
    private final NamedParameterJdbcTemplate jdbcTemplate;

    public record MatchesBody(String body) {
    }

    public record OddsBody(String oddsList, Map<String, String> details) {
    }

    public record MatchSummary(String externalId, String eventDate, Integer statusId, Boolean hasOdds,
                               Boolean hasOddsCorner) {
    }

    @PostMapping("/dates/{date}/matches")
    public List<MatchSummary> matches(@PathVariable String date, @RequestBody MatchesBody request) {
        var day = parseDate(date);
        var body = decode(request == null ? null : request.body());
        var response = mapGuarded("AISCORE_DECODE_FAILED", HttpStatus.UNPROCESSABLE_ENTITY,
                () -> dateCrawlService.mapMatches(day, body));
        List<CrawledMatchBundleDto> events = response.events() == null ? List.of() : response.events();
        mapGuarded("AISCORE_PERSIST_FAILED", HttpStatus.INTERNAL_SERVER_ERROR,
                () -> retryOnLockFailure(() -> crawDateService.persistDate(day, events)));
        return events.stream()
                .map(CrawledMatchBundleDto::event)
                .filter(e -> e != null && e.externalId() != null)
                .map(e -> new MatchSummary(e.externalId(), e.eventDate(), e.statusId(), e.hasOdds(), e.hasOddsCorner()))
                .toList();
    }

    @GetMapping("/odds/candidates")
    public List<String> candidates(@RequestParam String date) {
        var from = LocalDate.parse(parseDate(date), DateTimeFormatter.BASIC_ISO_DATE).atStartOfDay();
        // event_date is stored in Asia/Ho_Chi_Minh local time.
        return mapGuarded("AISCORE_PERSIST_FAILED", HttpStatus.INTERNAL_SERVER_ERROR, () -> jdbcTemplate.queryForList(
                SQL_CANDIDATES,
                new MapSqlParameterSource("from", from).addValue("to", from.plusDays(1)),
                String.class));
    }

    @PostMapping("/events/{externalId}/odds")
    public Map<String, Object> odds(@PathVariable String externalId, @RequestBody OddsBody request) {
        if (!EXTERNAL_ID.matcher(externalId).matches()) {
            throw new BusinessException("AISCORE_INVALID_EXTERNAL_ID", HttpStatus.BAD_REQUEST);
        }
        if (request == null || request.details() == null) {
            throw new BusinessException("AISCORE_INVALID_BODY: missing odds payload", HttpStatus.BAD_REQUEST);
        }
        var oddsList = decode(request.oddsList());
        Map<String, byte[]> details = new HashMap<>();
        request.details().forEach((k, v) -> details.put(k, decode(v)));

        var row = mapGuarded("AISCORE_PERSIST_FAILED", HttpStatus.INTERNAL_SERVER_ERROR,
                () -> crawEventService.loadEventRowByExternalId(externalId));
        if (row == null) {
            throw BusinessException.notFound("AISCORE_EVENT_NOT_FOUND");
        }
        var response = mapGuarded("AISCORE_DECODE_FAILED", HttpStatus.UNPROCESSABLE_ENTITY,
                () -> eventCrawlService.mapOdds(externalId, oddsList, details));
        if (response.isEmpty()) {
            return Map.of("status", "no_bet365");
        }
        // DB row decides corner (like the Rabbit flow); the extension's cache may be stale.
        // Persisting without corner would wipe the existing corner timeline.
        if (Boolean.TRUE.equals(row.hasOddsCorner()) && details.get("corner") == null) {
            throw new BusinessException("AISCORE_ODDS_DETAIL_FETCH_FAILED: corner", HttpStatus.UNPROCESSABLE_ENTITY);
        }
        mapGuarded("AISCORE_PERSIST_FAILED", HttpStatus.INTERNAL_SERVER_ERROR,
                () -> retryOnLockFailure(() -> crawEventService.persistCrawlResult(row.eventId(), response)));
        return Map.of("status", "ok", "oddsRows", response.odds() == null ? 0 : response.odds().size());
    }

    private static String parseDate(String date) {
        if (date == null || !DATE.matcher(date).matches()) {
            throw new BusinessException("AISCORE_INVALID_DATE", HttpStatus.BAD_REQUEST);
        }
        try {
            LocalDate.parse(date, DateTimeFormatter.BASIC_ISO_DATE);
        } catch (DateTimeParseException ex) {
            throw new BusinessException("AISCORE_INVALID_DATE", HttpStatus.BAD_REQUEST);
        }
        return date;
    }

    private static byte[] decode(String b64) {
        if (b64 == null || b64.isEmpty()) {
            throw new BusinessException("AISCORE_INVALID_BASE64", HttpStatus.BAD_REQUEST);
        }
        try {
            return Base64.getDecoder().decode(b64);
        } catch (IllegalArgumentException ex) {
            throw new BusinessException("AISCORE_INVALID_BASE64", HttpStatus.BAD_REQUEST);
        }
    }

    /**
     * MySQL picks a deadlock victim and rolls its transaction back; the documented fix is to re-run it.
     * Each call goes through the service proxy, so every attempt is a fresh transaction.
     */
    private static Void retryOnLockFailure(Runnable persist) {
        for (int attempt = 1; ; attempt++) {
            try {
                persist.run();
                return null;
            } catch (PessimisticLockingFailureException ex) {
                if (attempt >= LOCK_ATTEMPTS) {
                    throw ex;
                }
                log.warn("ext lock failure, retry {}/{}: {}", attempt, LOCK_ATTEMPTS - 1, ex.getClass().getSimpleName());
                try {
                    Thread.sleep(ThreadLocalRandom.current().nextLong(50, 150) * attempt);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw ex;
                }
            }
        }
    }

    /** Local only: the global handler would echo the Jackson/param message (may quote the payload). */
    @ExceptionHandler({HttpMessageNotReadableException.class, MissingServletRequestParameterException.class})
    public ResponseEntity<Map<String, Object>> badRequest(Exception ex) {
        return ResponseEntity.badRequest().body(Map.of("error", "Bad Request", "message", "AISCORE_INVALID_BODY"));
    }

    /**
     * Keep BusinessException (domain code); hide anything else behind a domain code, no payload/stack.
     * DB failures stay 5xx so the extension stops the run instead of failing every event.
     */
    private static <T> T mapGuarded(String code, HttpStatus status, java.util.function.Supplier<T> work) {
        try {
            return work.get();
        } catch (BusinessException ex) {
            throw ex;
        } catch (RuntimeException ex) {
            log.warn("ext {}: {}", code, ex.toString()); // class + message only, never the payload
            throw new BusinessException(code, status);
        }
    }
}
