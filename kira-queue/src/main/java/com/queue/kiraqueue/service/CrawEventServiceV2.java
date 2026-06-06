package com.queue.kiraqueue.service;

import com.queue.kiraqueue.crawl.EventCrawlService;
import com.queue.kiraqueue.dto.aiscore.CrawlOddsSnapshotDto;
import com.queue.kiraqueue.dto.aiscore.CrawlOddsTimelineGroupDto;
import com.queue.kiraqueue.dto.aiscore.CrawlOddsTimelineItemDto;
import com.queue.kiraqueue.dto.aiscore.MatchOddsResponseDto;
import com.queue.kiraqueue.util.JdbcBatchUtils;
import lombok.extern.java.Log;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.logging.Level;

@Log
@Service
public class CrawEventServiceV2 {

    private static final Set<String> SUPPORTED_ODDS_MARKETS = Set.of("hdc", "ou", "corner");
    private static final Set<String> IN_PLAY_STATUS_FALLBACK = Set.of("1H", "HT", "2H", "ET", "Penalties");

    private static final String SQL_SELECT_EVENT = """
            select e.event_id,
                   e.link,
                   e.has_odds_corner,
                   e.status,
                   coalesce(r.is_terminal, 0) as is_terminal,
                   coalesce(r.is_in_play, 0) as is_in_play
            from events e
            left join aiscore_match_status_ref r
              on r.status_type = 'status_id'
             and r.code = e.status_id
             and r.sport_id = 1
            where e.event_id = :eventId
            """;

    private static final String SQL_CLEAR_EVENT_ODDS_FLAGS = """
            update events
            set has_odds = false,
                has_odds_corner = false
            where event_id = :event_id
            """;

    private static final String SQL_DELETE_EVENT_ODDS = "delete from event_odds where event_id = :event_id";
    private static final String SQL_DELETE_EVENT_ODDS_TIMELINE = "delete from event_odds_timeline where event_id = :event_id";

    private static final String SQL_INSERT_EVENT_ODDS = """
            insert ignore into event_odds (event_id, type, market, line, price_a, price_b)
            values (:event_id, :type, :market, :line, :price_a, :price_b)
            """;

    private static final String SQL_INSERT_EVENT_ODDS_TIMELINE = """
            insert into event_odds_timeline (event_id, market, line, price_a, price_b, match_minute, crawled_at)
            values (:event_id, :market, :line, :price_a, :price_b, :match_minute, :crawled_at)
            """;

    private static final String SQL_DELETE_EVENT_CLAIM =
            "delete from event_claim where event_id = :event_id";

    private static final String SQL_FAIL_EVENT_CLAIM = """
            update event_claim
            set status = 'failed'
            where event_id = :event_id
            """;

    private static final String SQL_COMPLETE_EVENT_CLAIM = """
            update event_claim
            set status = 'completed'
            where event_id = :event_id
            """;

    private static final String SQL_UPSERT_EVENT_DATA_ISSUE = """
            insert into event_data_issue (event_id, issue_type, description, recorded_at)
            values (:eventId, :issueType, :description, :recordedAt)
            on duplicate key update description = values(description),
                                    recorded_at = values(recorded_at)
            """;

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final EventCrawlService eventCrawlService;

    public CrawEventServiceV2(
            NamedParameterJdbcTemplate jdbcTemplate,
            EventCrawlService eventCrawlService
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.eventCrawlService = eventCrawlService;
    }

    public boolean processEvent(long eventId) {
        var eventRow = jdbcTemplate.query(
                SQL_SELECT_EVENT,
                Map.of("eventId", eventId),
                (rs, rn) -> new EventRow(
                        rs.getLong("event_id"),
                        rs.getString("link"),
                        rs.getObject("has_odds_corner", Boolean.class),
                        rs.getString("status"),
                        rs.getInt("is_terminal"),
                        rs.getInt("is_in_play")
                )
        ).stream().findFirst().orElse(null);

        if (eventRow == null) {
            log.warning("CrawEventServiceV2 >> event not found: " + eventId);
            failEventClaim(eventId);
            return false;
        }
        if (!StringUtils.hasText(eventRow.link())) {
            log.warning("CrawEventServiceV2 >> event has no link: " + eventId);
            failEventClaim(eventId);
            return false;
        }

        try {
            var matchId = extractMatchIdFromLink(eventRow.link());
            if (!StringUtils.hasText(matchId)) {
                log.warning("CrawEventServiceV2 >> cannot parse matchId from link: eventId=" + eventId);
                failEventClaim(eventId);
                return false;
            }

            MatchOddsResponseDto response = eventCrawlService.crawlEvent(matchId);
            if (response.isEmpty()) {
                log.warning("CrawEventServiceV2 >> empty odds crawl response (no Bet365?): eventId=" + eventId);
                failEventClaim(eventId);
                return false;
            }
            persistCrawlResult(eventId, response);
            handleClaimAfterSuccess(eventRow);
            return true;
        } catch (Exception ex) {
            log.log(Level.WARNING, "CrawEventServiceV2 >> failed eventId=" + eventId, ex);
            failEventClaim(eventId);
            return false;
        }
    }

    public void failEventClaim(long eventId) {
        jdbcTemplate.update(SQL_FAIL_EVENT_CLAIM, Map.of("event_id", eventId));
    }

    public void releaseEventClaim(long eventId) {
        jdbcTemplate.update(SQL_DELETE_EVENT_CLAIM, Map.of("event_id", eventId));
    }

    private void completeEventClaim(long eventId) {
        jdbcTemplate.update(SQL_COMPLETE_EVENT_CLAIM, Map.of("event_id", eventId));
    }

    private void persistCrawlResult(long eventId, MatchOddsResponseDto response) {
        if (CollectionUtils.isEmpty(response.odds())) {
            clearEventOddsFlags(eventId);
        }
        persistOdds(eventId, response.odds(), response.oddsTimeline());
    }

    private static String extractMatchIdFromLink(String link) {
        var trimmed = link.strip();
        var lastSlash = trimmed.lastIndexOf('/');
        if (lastSlash < 0 || lastSlash == trimmed.length() - 1) {
            return null;
        }
        return trimmed.substring(lastSlash + 1);
    }

    private void clearEventOddsFlags(long eventId) {
        jdbcTemplate.update(SQL_CLEAR_EVENT_ODDS_FLAGS, Map.of("event_id", eventId));
    }

    private void handleClaimAfterSuccess(EventRow eventRow) {
        if (shouldReleaseClaimAfterSuccess(eventRow.playState())) {
            releaseEventClaim(eventRow.eventId());
        } else {
            completeEventClaim(eventRow.eventId());
        }
    }

    private static boolean shouldReleaseClaimAfterSuccess(EventPlayState state) {
        if (state.isInPlay() == 1) {
            return true;
        }
        if (state.isTerminal() == 1) {
            return false;
        }
        if (StringUtils.hasText(state.status())) {
            if (IN_PLAY_STATUS_FALLBACK.contains(state.status())) {
                return true;
            }
            if ("FT".equalsIgnoreCase(state.status())) {
                return false;
            }
        }
        return false;
    }

    private void recordMissingOdds(long eventId) {
        jdbcTemplate.update(
                SQL_UPSERT_EVENT_DATA_ISSUE,
                new MapSqlParameterSource("eventId", eventId)
                        .addValue("issueType", "missing_odds")
                        .addValue("description", "No Bet365 odds from aiscore crawl")
                        .addValue("recordedAt", LocalDateTime.now())
        );
    }

    private void persistOdds(long eventId, List<CrawlOddsSnapshotDto> odds, CrawlOddsTimelineGroupDto timeline) {
        long persistStart = System.nanoTime();

        long deleteTimelineStart = System.nanoTime();
        jdbcTemplate.update(SQL_DELETE_EVENT_ODDS_TIMELINE, Map.of("event_id", eventId));
        long deleteTimelineMs = elapsedMillis(deleteTimelineStart);

        long deleteOddsStart = System.nanoTime();
        jdbcTemplate.update(SQL_DELETE_EVENT_ODDS, Map.of("event_id", eventId));
        long deleteOddsMs = elapsedMillis(deleteOddsStart);

        int oddsRows = 0;
        long oddsMs = 0;
        if (!CollectionUtils.isEmpty(odds)) {
            var oddsParams = odds.stream()
                    .filter(o -> isSupportedMarket(o.market()))
                    .filter(o -> StringUtils.hasText(o.type()))
                    .map(o -> new MapSqlParameterSource()
                            .addValue("event_id", eventId)
                            .addValue("type", normalizeOddsType(o.type()))
                            .addValue("market", o.market())
                            .addValue("line", o.line())
                            .addValue("price_a", o.priceA())
                            .addValue("price_b", o.priceB()))
                    .toList();
            oddsRows = oddsParams.size();
            long oddsStart = System.nanoTime();
            JdbcBatchUtils.batchInsertSafe(jdbcTemplate, SQL_INSERT_EVENT_ODDS, oddsParams);
            oddsMs = elapsedMillis(oddsStart);
        }

        var timelineParams = flattenTimeline(eventId, timeline);
        int timelineRows = timelineParams.size();
        long timelineMs = 0;
        if (!timelineParams.isEmpty()) {
            long timelineStart = System.nanoTime();
            JdbcBatchUtils.batchInsertSafe(jdbcTemplate, SQL_INSERT_EVENT_ODDS_TIMELINE, timelineParams);
            timelineMs = elapsedMillis(timelineStart);
        }

        log.info("persistOdds eventId=%d deleteTimelineMs=%d deleteOddsMs=%d oddsRows=%d oddsMs=%d timelineRows=%d timelineMs=%d totalMs=%d"
                .formatted(
                        eventId,
                        deleteTimelineMs,
                        deleteOddsMs,
                        oddsRows,
                        oddsMs,
                        timelineRows,
                        timelineMs,
                        elapsedMillis(persistStart)
                ));
    }

    private static long elapsedMillis(long startNano) {
        return (System.nanoTime() - startNano) / 1_000_000L;
    }

    private List<MapSqlParameterSource> flattenTimeline(long eventId, CrawlOddsTimelineGroupDto timeline) {
        if (timeline == null) {
            return List.of();
        }
        var params = new ArrayList<MapSqlParameterSource>();
        appendTimelineItems(eventId, params, timeline.hdc());
        appendTimelineItems(eventId, params, timeline.ou());
        appendTimelineItems(eventId, params, timeline.corner());
        return params;
    }

    private void appendTimelineItems(
            long eventId,
            List<MapSqlParameterSource> params,
            List<CrawlOddsTimelineItemDto> items
    ) {
        if (CollectionUtils.isEmpty(items)) {
            return;
        }
        var defaultCrawledAt = LocalDateTime.now();
        for (CrawlOddsTimelineItemDto item : items) {
            if (!isSupportedMarket(item.market())) {
                continue;
            }
            params.add(new MapSqlParameterSource()
                    .addValue("event_id", eventId)
                    .addValue("market", item.market())
                    .addValue("line", item.line())
                    .addValue("price_a", item.priceA())
                    .addValue("price_b", item.priceB())
                    .addValue("match_minute", item.matchMinute())
                    .addValue("crawled_at", parseCrawledAt(item.crawledAt(), defaultCrawledAt)));
        }
    }

    private static boolean isSupportedMarket(String market) {
        return StringUtils.hasText(market) && SUPPORTED_ODDS_MARKETS.contains(market);
    }

    private static String normalizeOddsType(String type) {
        return "ht".equals(type) ? "half-time" : type;
    }

    private static LocalDateTime parseCrawledAt(String crawledAt, LocalDateTime fallback) {
        if (!StringUtils.hasText(crawledAt)) {
            return fallback;
        }
        try {
            return OffsetDateTime.parse(crawledAt).toLocalDateTime();
        } catch (Exception ignored) {
            return fallback;
        }
    }

    private record EventRow(
            long eventId,
            String link,
            Boolean hasOddsCorner,
            String status,
            int isTerminal,
            int isInPlay
    ) {
        EventPlayState playState() {
            return new EventPlayState(
                    status == null ? "-" : status,
                    isTerminal,
                    isInPlay
            );
        }
    }

    private record EventPlayState(String status, int isTerminal, int isInPlay) {
    }
}
