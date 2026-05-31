package kira.crawl.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import kira.crawl.config.PlaywrightProperties;
import kira.crawl.dto.CrawlMatchOddsV2Dto;
import kira.crawl.dto.MatchOddsResponseDto;
import kira.crawl.dto.MatchesResponseDto;
import kira.crawl.service.MatchesService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.async.WebAsyncTask;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/matches")
@RequiredArgsConstructor
@Tag(name = "matches")
public class MatchesController {

    private final MatchesService matchesService;
    private final PlaywrightProperties playwrightProperties;

    @GetMapping
    @Operation(summary = "List matches for a given date")
    public WebAsyncTask<Object> findMatches(
            @RequestParam(required = false) String date,
            @RequestParam(name = "sport_id", required = false) String sportId,
            @RequestParam(required = false) String lang,
            @RequestParam(required = false) String tz,
            @RequestParam(name = "match_id", required = false) String matchId,
            @RequestParam(required = false) String raw
    ) {
        var logParams = logParams(
                "date", date,
                "sportId", sportId,
                "lang", lang,
                "tz", tz,
                "matchId", matchId,
                "raw", raw
        );
        return crawlTask(
                "matches",
                playwrightProperties.matchesAsyncTimeoutMs(),
                logParams,
                () -> matchesService.findMatches(new MatchesService.MatchQuery(date, sportId, lang, tz, matchId, raw))
        );
    }

    @GetMapping("v2/odds")
    public WebAsyncTask<Object> getOdds(@RequestParam(name = "event_link") String eventLink,
                                        @RequestParam(name = "has_odds_corner", required = false) Boolean hasOddsCorner) {
        var logParams = logParams(
                "eventLinkSuffix", eventLinkSuffix(eventLink),
                "hasOddsCorner", hasOddsCorner == null ? null : String.valueOf(hasOddsCorner)
        );
        return crawlTask(
                "oddsV2",
                playwrightProperties.oddsAsyncTimeoutMs(),
                logParams,
                () -> matchesService.getOdds(eventLink, hasOddsCorner)
        );
    }

    @GetMapping("v3/odds")
    public WebAsyncTask<Object> getOddsV3(@RequestParam(name = "event_link") String eventLink,
                                          @RequestParam(name = "has_odds_corner", required = false) Boolean hasOddsCorner) {
        var logParams = logParams(
                "eventLinkSuffix", eventLinkSuffix(eventLink),
                "hasOddsCorner", hasOddsCorner == null ? null : String.valueOf(hasOddsCorner)
        );
        return crawlTask(
                "oddsV3",
                playwrightProperties.oddsAsyncTimeoutMs(),
                logParams,
                () -> matchesService.getOddsV3(eventLink, hasOddsCorner)
        );
    }

    @GetMapping("/odds")
    @Operation(summary = "Crawl odds for a single match")
    public WebAsyncTask<Object> findMatchOdds(
            @RequestParam(name = "event_link") String eventLink,
            @RequestParam(name = "has_odds_corner", required = false) Boolean hasOddsCorner
    ) {
        var logParams = logParams(
                "eventLinkSuffix", eventLinkSuffix(eventLink),
                "hasOddsCorner", hasOddsCorner == null ? null : String.valueOf(hasOddsCorner)
        );
        return crawlTask(
                "odds",
                playwrightProperties.oddsAsyncTimeoutMs(),
                logParams,
                () -> matchesService.findMatchOdds(eventLink, hasOddsCorner)
        );
    }

    private WebAsyncTask<Object> crawlTask(
            String operation,
            long asyncTimeoutMs,
            Map<String, String> logParams,
            ThrowingSupplier supplier
    ) {
        log.info("Crawl request received operation={} {}", operation, formatLogParams(logParams));
        long startTime = System.currentTimeMillis();

        var task = new WebAsyncTask<>(asyncTimeoutMs, () -> {
            try {
                var result = supplier.get();
                log.info(
                        "Crawl request completed operation={} {} {} durationMs={}",
                        operation,
                        formatLogParams(logParams),
                        summarizeResult(result),
                        System.currentTimeMillis() - startTime
                );
                return result;
            } catch (Exception ex) {
                log.warn(
                        "Crawl request failed operation={} {} durationMs={}",
                        operation,
                        formatLogParams(logParams),
                        System.currentTimeMillis() - startTime,
                        ex
                );
                throw ex;
            }
        });

        task.onTimeout(() -> {
            log.warn(
                    "Crawl request timed out operation={} {} durationMs={}",
                    operation,
                    formatLogParams(logParams),
                    System.currentTimeMillis() - startTime
            );
            throw new ResponseStatusException(HttpStatus.REQUEST_TIMEOUT, "AiScore crawl request timed out");
        });
        task.onError(() -> {
            log.warn(
                    "Crawl request error operation={} {} durationMs={}",
                    operation,
                    formatLogParams(logParams),
                    System.currentTimeMillis() - startTime
            );
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AiScore crawl request failed");
        });
        return task;
    }

    private static Map<String, String> logParams(String... keyValues) {
        var params = new LinkedHashMap<String, String>();
        for (int i = 0; i < keyValues.length; i += 2) {
            params.put(keyValues[i], orDash(keyValues[i + 1]));
        }
        return params;
    }

    private static String formatLogParams(Map<String, String> params) {
        return params.entrySet().stream()
                .map(entry -> entry.getKey() + "=" + entry.getValue())
                .collect(Collectors.joining(" "));
    }

    private static String orDash(String value) {
        return StringUtils.hasText(value) ? value : "-";
    }

    static String eventLinkSuffix(String eventLink) {
        if (!StringUtils.hasText(eventLink)) {
            return "-";
        }
        try {
            var path = URI.create(eventLink.trim()).getPath();
            if (!StringUtils.hasText(path) || "/".equals(path)) {
                return eventLink.trim();
            }
            var normalized = path.endsWith("/") ? path.substring(0, path.length() - 1) : path;
            var slash = normalized.lastIndexOf('/');
            return slash >= 0 ? normalized.substring(slash + 1) : normalized;
        } catch (IllegalArgumentException ex) {
            var trimmed = eventLink.trim();
            var slash = trimmed.lastIndexOf('/');
            return slash >= 0 ? trimmed.substring(slash + 1) : trimmed;
        }
    }

    static String summarizeResult(Object result) {
        if (result instanceof MatchesResponseDto dto) {
            return "total=" + (dto.total() != null ? dto.total() : 0);
        }
        if (result instanceof MatchOddsResponseDto dto) {
            if (!StringUtils.hasText(dto.matchId())) {
                return "empty=true";
            }
            return "matchId=" + dto.matchId();
        }
        if (result instanceof CrawlMatchOddsV2Dto dto) {
            if (!StringUtils.hasText(dto.matchId())) {
                return "empty=true";
            }
            return "matchId=" + dto.matchId()
                    + " odds=" + (dto.odds() == null ? 0 : dto.odds().size())
                    + " timeline=" + (dto.timelineOdds() != null)
                    + " event=" + (dto.event() != null)
                    + " eventResult=" + (dto.eventResult() != null);
        }
        if (result instanceof Map<?, ?> map) {
            return map.isEmpty() ? "empty=true" : "raw=true";
        }
        return "resultType=" + (result != null ? result.getClass().getSimpleName() : "null");
    }

    @FunctionalInterface
    private interface ThrowingSupplier {
        Object get();
    }
}
