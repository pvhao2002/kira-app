package com.queue.kiraqueue.service;

import com.queue.kiraqueue.config.BusinessException;
import com.queue.kiraqueue.crawl.EventCrawlService;
import com.queue.kiraqueue.dto.MarketOddsSnapshot;
import com.queue.kiraqueue.dto.OddsSnapshot;
import com.queue.kiraqueue.dto.PredictJobMessage;
import com.queue.kiraqueue.dto.PredictUrlRequest;
import com.queue.kiraqueue.dto.PredictUrlResponse;
import com.queue.kiraqueue.dto.VersionPredictionResult;
import com.queue.kiraqueue.dto.aiscore.CrawlOddsSnapshotDto;
import com.queue.kiraqueue.dto.aiscore.MatchOddsResponseDto;
import com.queue.kiraqueue.prediction.PredictionEngineRegistry;
import com.queue.kiraqueue.prediction.TargetEventOdds;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class OnDemandUrlPredictService {

    private static final long UNKNOWN_EVENT_ID = -1L;
    private static final List<String> VERSION_CODES = List.of(
            PredictJobMessage.VERSION_NO_PRICE,
            PredictJobMessage.VERSION_WITH_PRICE,
            PredictJobMessage.VERSION_WITH_LEAGUE_NO_PRICE
    );
    private static final List<String> MARKETS = List.of("hdc", "ou", "corner");

    private final EventCrawlService eventCrawlService;
    private final PredictionEngineRegistry engineRegistry;
    private final NamedParameterJdbcTemplate jdbcTemplate;

    public PredictUrlResponse predict(PredictUrlRequest request) {
        var url = request == null ? null : request.url();
        if (!StringUtils.hasText(url)) {
            throw new BusinessException("url is required");
        }

        var trimmedUrl = url.trim();
        var matchId = extractMatchId(trimmedUrl);
        if (!StringUtils.hasText(matchId)) {
            throw new BusinessException("Cannot parse matchId from url");
        }

        var existingEvent = loadExistingEvent(trimmedUrl, matchId);
        var eventId = existingEvent == null ? UNKNOWN_EVENT_ID : existingEvent.eventId();
        var leagueId = existingEvent == null ? null : existingEvent.leagueId();
        var eventRow = new CrawEventServiceV2.EventRow(
                eventId,
                trimmedUrl,
                true,
                true,
                null,
                0,
                0,
                matchId
        );

        var crawlResponse = eventCrawlService.crawlEvent(matchId, eventRow);
        if (crawlResponse == null || crawlResponse.isEmpty() || CollectionUtils.isEmpty(crawlResponse.odds())) {
            throw new BusinessException("Empty odds crawl response (no Bet365?): matchId=" + matchId);
        }

        var oddsByMarket = buildOddsResponse(crawlResponse);
        var targetOdds = buildTargetOdds(eventId, leagueId, crawlResponse.odds());
        var predictions = computePredictions(targetOdds);

        return new PredictUrlResponse(
                trimmedUrl,
                matchId,
                existingEvent == null ? null : existingEvent.eventId(),
                Map.copyOf(oddsByMarket),
                Map.copyOf(predictions)
        );
    }

    private Map<String, VersionPredictionResult> computePredictions(TargetEventOdds odds) {
        var predictions = new LinkedHashMap<String, VersionPredictionResult>();
        for (String versionCode : VERSION_CODES) {
            var engine = engineRegistry.findEngine(versionCode);
            if (engine.isEmpty()) {
                predictions.put(versionCode, new VersionPredictionResult(
                        "skipped", null, null, null, null, null, null, null, null,
                        "No prediction engine registered for version: " + versionCode));
                continue;
            }
            predictions.put(versionCode, engine.get().compute(odds));
        }
        return predictions;
    }

    private Map<String, MarketOddsSnapshot> buildOddsResponse(MatchOddsResponseDto response) {
        var result = new LinkedHashMap<String, MarketOddsSnapshot>();
        for (String market : MARKETS) {
            result.put(market, new MarketOddsSnapshot(
                    toSnapshot(findOdds(response.odds(), market, "open")),
                    toSnapshot(findOdds(response.odds(), market, "pre-match"))
            ));
        }
        return result;
    }

    private TargetEventOdds buildTargetOdds(long eventId, Long leagueId, List<CrawlOddsSnapshotDto> odds) {
        var openHdc = findOdds(odds, "hdc", "open");
        var prematchHdc = findOdds(odds, "hdc", "pre-match");
        var openOu = findOdds(odds, "ou", "open");
        var prematchOu = findOdds(odds, "ou", "pre-match");
        var openCorner = findOdds(odds, "corner", "open");
        var prematchCorner = findOdds(odds, "corner", "pre-match");

        return new TargetEventOdds(
                eventId,
                leagueId,
                line(openHdc),
                line(prematchHdc),
                line(openOu),
                line(prematchOu),
                line(openCorner),
                line(prematchCorner),
                priceA(openHdc),
                priceB(openHdc),
                priceA(openOu),
                priceB(openOu),
                priceA(openCorner),
                priceB(openCorner),
                priceA(prematchHdc),
                priceB(prematchHdc),
                priceA(prematchOu),
                priceB(prematchOu),
                priceA(prematchCorner),
                priceB(prematchCorner)
        );
    }

    private ExistingEvent loadExistingEvent(String url, String matchId) {
        var rows = jdbcTemplate.query(
                """
                select event_id, league_id
                from events
                where link = :url
                   or external_id = :match_id
                order by event_id desc
                limit 1
                """,
                Map.of("url", url, "match_id", matchId),
                (rs, rowNum) -> new ExistingEvent(
                        rs.getLong("event_id"),
                        rs.getObject("league_id", Long.class)
                )
        );
        return rows.isEmpty() ? null : rows.getFirst();
    }

    private static CrawlOddsSnapshotDto findOdds(List<CrawlOddsSnapshotDto> odds, String market, String type) {
        if (CollectionUtils.isEmpty(odds)) {
            return null;
        }
        return odds.stream()
                .filter(item -> market.equals(item.market()))
                .filter(item -> type.equals(item.type()))
                .findFirst()
                .orElse(null);
    }

    private static OddsSnapshot toSnapshot(CrawlOddsSnapshotDto odds) {
        if (odds == null) {
            return null;
        }
        return new OddsSnapshot(odds.line(), odds.priceA(), odds.priceB());
    }

    private static String line(CrawlOddsSnapshotDto odds) {
        return odds == null ? null : odds.line();
    }

    private static BigDecimal priceA(CrawlOddsSnapshotDto odds) {
        return decimal(odds == null ? null : odds.priceA());
    }

    private static BigDecimal priceB(CrawlOddsSnapshotDto odds) {
        return decimal(odds == null ? null : odds.priceB());
    }

    private static BigDecimal decimal(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        try {
            return new BigDecimal(value);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static String extractMatchId(String url) {
        var value = url.strip();
        var queryIndex = value.indexOf('?');
        if (queryIndex >= 0) {
            value = value.substring(0, queryIndex);
        }
        var fragmentIndex = value.indexOf('#');
        if (fragmentIndex >= 0) {
            value = value.substring(0, fragmentIndex);
        }
        while (value.endsWith("/")) {
            value = value.substring(0, value.length() - 1);
        }
        var lastSlash = value.lastIndexOf('/');
        if (lastSlash < 0 || lastSlash == value.length() - 1) {
            return null;
        }
        return value.substring(lastSlash + 1);
    }

    private record ExistingEvent(long eventId, Long leagueId) {
    }
}
