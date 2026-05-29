package com.queue.kiraqueue.service;

import com.queue.kiraqueue.client.KiraCrawlClient;
import com.queue.kiraqueue.config.CrawlPersistExecutorConfig;
import com.queue.kiraqueue.dto.crawl.CrawlEventResultDto;
import com.queue.kiraqueue.dto.crawl.CrawlMatchOddsEventDto;
import com.queue.kiraqueue.dto.crawl.CrawlOddsSnapshotDto;
import com.queue.kiraqueue.dto.crawl.CrawlOddsTimelineGroupDto;
import com.queue.kiraqueue.dto.crawl.CrawlOddsTimelineItemDto;
import com.queue.kiraqueue.dto.crawl.MatchOddsResponse;
import com.queue.kiraqueue.util.JdbcBatchUtils;
import lombok.extern.java.Log;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Executor;
import java.util.logging.Level;

@Log
@Service
public class CrawEventServiceV2 {

    private static final Set<String> SUPPORTED_ODDS_MARKETS = Set.of("hdc", "ou", "corner");
    private static final Set<String> IN_PLAY_STATUS_FALLBACK = Set.of("1H", "HT", "2H", "ET", "Penalties");

    private static final String SQL_SELECT_EVENT = """
            select event_id, link, has_odds_corner
            from events
            where event_id = :eventId
            """;

    private static final String SQL_SELECT_EVENT_PLAY_STATE = """
            select e.status,
                   coalesce(r.is_terminal, 0) as is_terminal,
                   coalesce(r.is_in_play, 0) as is_in_play
            from events e
            left join aiscore_match_status_ref r
              on r.status_type = 'status_id'
             and r.code = e.status_id
             and r.sport_id = 1
            where e.event_id = :eventId
            """;

    private static final String SQL_UPDATE_EVENT = """
            update events
            set status = :status,
                status_id = :status_id
            where event_id = :event_id
            """;

    private static final String SQL_CLEAR_EVENT_ODDS_FLAGS = """
            update events
            set has_odds = false,
                has_odds_corner = false
            where event_id = :event_id
            """;

    private static final String SQL_UPSERT_EVENT_RESULT = """
            insert into event_result (
                event_id,
                ht_result, ht_goal_str, ft_result, ft_goal_str,
                ht_home_goal, ht_away_goal, ft_home_goal, ft_away_goal,
                ht_home_corner, ht_away_corner, ft_home_corner, ft_away_corner,
                ht_home_yellow_card, ht_away_yellow_card, ft_home_yellow_card, ft_away_yellow_card,
                ht_home_foul, ht_away_foul, ft_home_foul, ft_away_foul,
                ht_home_offside, ht_away_offside, ft_home_offside, ft_away_offside,
                ht_home_total_shot, ht_away_total_shot, ft_home_total_shot, ft_away_total_shot,
                ht_home_shot_on_target, ht_away_shot_on_target, ft_home_shot_on_target, ft_away_shot_on_target
            ) values (
                :event_id,
                :ht_result, :ht_goal_str, :ft_result, :ft_goal_str,
                :ht_home_goal, :ht_away_goal, :ft_home_goal, :ft_away_goal,
                :ht_home_corner, :ht_away_corner, :ft_home_corner, :ft_away_corner,
                :ht_home_yellow_card, :ht_away_yellow_card, :ft_home_yellow_card, :ft_away_yellow_card,
                :ht_home_foul, :ht_away_foul, :ft_home_foul, :ft_away_foul,
                :ht_home_offside, :ht_away_offside, :ft_home_offside, :ft_away_offside,
                :ht_home_total_shot, :ht_away_total_shot, :ft_home_total_shot, :ft_away_total_shot,
                :ht_home_shot_on_target, :ht_away_shot_on_target, :ft_home_shot_on_target, :ft_away_shot_on_target
            )
            on duplicate key update
                ht_result = values(ht_result),
                ht_goal_str = values(ht_goal_str),
                ft_result = values(ft_result),
                ft_goal_str = values(ft_goal_str),
                ht_home_goal = values(ht_home_goal),
                ht_away_goal = values(ht_away_goal),
                ft_home_goal = values(ft_home_goal),
                ft_away_goal = values(ft_away_goal),
                ht_home_corner = values(ht_home_corner),
                ht_away_corner = values(ht_away_corner),
                ft_home_corner = values(ft_home_corner),
                ft_away_corner = values(ft_away_corner),
                ht_home_yellow_card = values(ht_home_yellow_card),
                ht_away_yellow_card = values(ht_away_yellow_card),
                ft_home_yellow_card = values(ft_home_yellow_card),
                ft_away_yellow_card = values(ft_away_yellow_card),
                ht_home_foul = values(ht_home_foul),
                ht_away_foul = values(ht_away_foul),
                ft_home_foul = values(ft_home_foul),
                ft_away_foul = values(ft_away_foul),
                ht_home_offside = values(ht_home_offside),
                ht_away_offside = values(ht_away_offside),
                ft_home_offside = values(ft_home_offside),
                ft_away_offside = values(ft_away_offside),
                ht_home_total_shot = values(ht_home_total_shot),
                ht_away_total_shot = values(ht_away_total_shot),
                ft_home_total_shot = values(ft_home_total_shot),
                ft_away_total_shot = values(ft_away_total_shot),
                ht_home_shot_on_target = values(ht_home_shot_on_target),
                ht_away_shot_on_target = values(ht_away_shot_on_target),
                ft_home_shot_on_target = values(ft_home_shot_on_target),
                ft_away_shot_on_target = values(ft_away_shot_on_target)
            """;

    private static final String SQL_DELETE_EVENT_ODDS = "delete from event_odds where event_id = :event_id";
    private static final String SQL_DELETE_EVENT_ODDS_TIMELINE = "delete from event_odds_timeline where event_id = :event_id";

    private static final String SQL_INSERT_EVENT_ODDS = """
            insert into event_odds (event_id, type, market, line, price_a, price_b)
            values (:event_id, :type, :market, :line, :price_a, :price_b)
            on duplicate key update
                line = values(line),
                price_a = values(price_a),
                price_b = values(price_b)
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
    private final KiraCrawlClient kiraCrawlClient;
    private final Executor crawlPersistExecutor;
    private final TransactionTemplate transactionTemplate;
    private final AiscoreMatchStatusLabelCache statusLabelCache;

    public CrawEventServiceV2(
            NamedParameterJdbcTemplate jdbcTemplate,
            KiraCrawlClient kiraCrawlClient,
            @Qualifier(CrawlPersistExecutorConfig.CRAWL_PERSIST_EXECUTOR) Executor crawlPersistExecutor,
            PlatformTransactionManager transactionManager,
            AiscoreMatchStatusLabelCache statusLabelCache
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.kiraCrawlClient = kiraCrawlClient;
        this.crawlPersistExecutor = crawlPersistExecutor;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.statusLabelCache = statusLabelCache;
    }

    public boolean processEvent(long eventId) {
        var eventRow = jdbcTemplate.query(
                SQL_SELECT_EVENT,
                Map.of("eventId", eventId),
                (rs, rn) -> new EventRow(
                        rs.getLong("event_id"),
                        rs.getString("link"),
                        rs.getObject("has_odds_corner", Boolean.class)
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
            MatchOddsResponse response = kiraCrawlClient.fetchMatchOdds(
                    eventRow.link(),
                    eventRow.hasOddsCorner()
            );
            if (response.isEmpty()) {
                log.warning("CrawEventServiceV2 >> empty kira-crawl response (no Bet365?): eventId=" + eventId);
                recordMissingOdds(eventId);
                failEventClaim(eventId);
                return false;
            }

            schedulePersist(eventId, response);
            return true;
        } catch (Exception ex) {
            log.log(Level.WARNING, "CrawEventServiceV2 >> failed eventId=" + eventId, ex);
            failEventClaim(eventId);
            return false;
        }
    }

    private void schedulePersist(long eventId, MatchOddsResponse response) {
        crawlPersistExecutor.execute(() -> {
            try {
                transactionTemplate.executeWithoutResult(status -> {
                    persistCrawlResult(eventId, response);
                    handleClaimAfterSuccess(eventId);
                });
                log.info("CrawEventServiceV2 >> saved eventId=" + eventId + " matchId=" + response.matchId());
            } catch (Exception ex) {
                log.log(Level.WARNING, "persist failed eventId=" + eventId, ex);
                failEventClaim(eventId);
            }
        });
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

    private void persistCrawlResult(long eventId, MatchOddsResponse response) {
        updateEvent(eventId, response.event());
        upsertEventResult(eventId, response.eventResult());
        if (CollectionUtils.isEmpty(response.odds())) {
            clearEventOddsFlags(eventId);
        }
        persistOdds(eventId, response.odds(), response.oddsTimeline());
    }

    private void clearEventOddsFlags(long eventId) {
        jdbcTemplate.update(SQL_CLEAR_EVENT_ODDS_FLAGS, Map.of("event_id", eventId));
    }

    private void handleClaimAfterSuccess(long eventId) {
        if (shouldReleaseClaimAfterSuccess(loadEventPlayState(eventId))) {
            releaseEventClaim(eventId);
        } else {
            completeEventClaim(eventId);
        }
    }

    private EventPlayState loadEventPlayState(long eventId) {
        return jdbcTemplate.query(
                SQL_SELECT_EVENT_PLAY_STATE,
                Map.of("eventId", eventId),
                (rs, rn) -> new EventPlayState(
                        rs.getString("status"),
                        rs.getInt("is_terminal"),
                        rs.getInt("is_in_play")
                )
        ).stream().findFirst().orElse(new EventPlayState("-", 0, 0));
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
                        .addValue("description", "No Bet365 odds from kira-crawl")
                        .addValue("recordedAt", LocalDateTime.now())
        );
    }

    private void updateEvent(long eventId, CrawlMatchOddsEventDto event) {
        if (event == null) {
            return;
        }
        jdbcTemplate.update(
                SQL_UPDATE_EVENT,
                new MapSqlParameterSource("event_id", eventId)
                        .addValue("status", statusLabelCache.resolveStatus(event.statusId(), event.status()))
                        .addValue("status_id", event.statusId())
        );
    }

    private void upsertEventResult(long eventId, CrawlEventResultDto result) {
        if (result == null) {
            return;
        }
        jdbcTemplate.update(SQL_UPSERT_EVENT_RESULT, toEventResultParams(eventId, result));
    }

    private void persistOdds(long eventId, List<CrawlOddsSnapshotDto> odds, CrawlOddsTimelineGroupDto timeline) {
        jdbcTemplate.update(SQL_DELETE_EVENT_ODDS_TIMELINE, Map.of("event_id", eventId));
        jdbcTemplate.update(SQL_DELETE_EVENT_ODDS, Map.of("event_id", eventId));

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
            JdbcBatchUtils.batchInsertSafe(jdbcTemplate, SQL_INSERT_EVENT_ODDS, oddsParams);
        }

        var timelineParams = flattenTimeline(eventId, timeline);
        if (!timelineParams.isEmpty()) {
            JdbcBatchUtils.batchInsertSafe(jdbcTemplate, SQL_INSERT_EVENT_ODDS_TIMELINE, timelineParams);
        }
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

    private static MapSqlParameterSource toEventResultParams(long eventId, CrawlEventResultDto result) {
        return new MapSqlParameterSource("event_id", eventId)
                .addValue("ht_result", result.htResult())
                .addValue("ht_goal_str", result.htGoalStr())
                .addValue("ft_result", result.ftResult())
                .addValue("ft_goal_str", result.ftGoalStr())
                .addValue("ht_home_goal", result.htHomeGoal())
                .addValue("ht_away_goal", result.htAwayGoal())
                .addValue("ft_home_goal", result.ftHomeGoal())
                .addValue("ft_away_goal", result.ftAwayGoal())
                .addValue("ht_home_corner", result.htHomeCorner())
                .addValue("ht_away_corner", result.htAwayCorner())
                .addValue("ft_home_corner", result.ftHomeCorner())
                .addValue("ft_away_corner", result.ftAwayCorner())
                .addValue("ht_home_yellow_card", result.htHomeYellowCard())
                .addValue("ht_away_yellow_card", result.htAwayYellowCard())
                .addValue("ft_home_yellow_card", result.ftHomeYellowCard())
                .addValue("ft_away_yellow_card", result.ftAwayYellowCard())
                .addValue("ht_home_foul", result.htHomeFoul())
                .addValue("ht_away_foul", result.htAwayFoul())
                .addValue("ft_home_foul", result.ftHomeFoul())
                .addValue("ft_away_foul", result.ftAwayFoul())
                .addValue("ht_home_offside", result.htHomeOffside())
                .addValue("ht_away_offside", result.htAwayOffside())
                .addValue("ft_home_offside", result.ftHomeOffside())
                .addValue("ft_away_offside", result.ftAwayOffside())
                .addValue("ht_home_total_shot", result.htHomeTotalShot())
                .addValue("ht_away_total_shot", result.htAwayTotalShot())
                .addValue("ft_home_total_shot", result.ftHomeTotalShot())
                .addValue("ft_away_total_shot", result.ftAwayTotalShot())
                .addValue("ht_home_shot_on_target", result.htHomeShotOnTarget())
                .addValue("ht_away_shot_on_target", result.htAwayShotOnTarget())
                .addValue("ft_home_shot_on_target", result.ftHomeShotOnTarget())
                .addValue("ft_away_shot_on_target", result.ftAwayShotOnTarget());
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

    private record EventRow(long eventId, String link, Boolean hasOddsCorner) {
    }

    private record EventPlayState(String status, int isTerminal, int isInPlay) {
    }
}
