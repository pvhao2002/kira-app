package com.db.kiragateway.repository;

import com.db.kiragateway.dto.crawl.CrawlEventResultDto;
import com.db.kiragateway.util.JdbcBatchUtils;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
public class OddsCrawlPersistRepository {

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

    private final NamedParameterJdbcTemplate jdbc;

    public OddsCrawlPersistRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void updateEvent(long eventId, String status, Integer statusId) {
        jdbc.update(
                SQL_UPDATE_EVENT,
                new MapSqlParameterSource("event_id", eventId)
                        .addValue("status", status)
                        .addValue("status_id", statusId)
        );
    }

    public void clearEventOddsFlags(long eventId) {
        jdbc.update(SQL_CLEAR_EVENT_ODDS_FLAGS, Map.of("event_id", eventId));
    }

    public void upsertEventResult(long eventId, CrawlEventResultDto result) {
        jdbc.update(SQL_UPSERT_EVENT_RESULT, toEventResultParams(eventId, result));
    }

    public void deleteOddsForEvent(long eventId) {
        jdbc.update(SQL_DELETE_EVENT_ODDS_TIMELINE, Map.of("event_id", eventId));
        jdbc.update(SQL_DELETE_EVENT_ODDS, Map.of("event_id", eventId));
    }

    public void batchInsertEventOdds(List<MapSqlParameterSource> params) {
        JdbcBatchUtils.batchInsertSafe(jdbc, SQL_INSERT_EVENT_ODDS, params);
    }

    public void batchInsertEventOddsTimeline(List<MapSqlParameterSource> params) {
        JdbcBatchUtils.batchInsertSafe(jdbc, SQL_INSERT_EVENT_ODDS_TIMELINE, params);
    }

    public Optional<EventPlayState> findEventPlayState(long eventId) {
        return jdbc.query(
                SQL_SELECT_EVENT_PLAY_STATE,
                Map.of("eventId", eventId),
                (rs, rn) -> new EventPlayState(
                        rs.getString("status"),
                        rs.getInt("is_terminal"),
                        rs.getInt("is_in_play")
                )
        ).stream().findFirst();
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

    public record EventPlayState(String status, int isTerminal, int isInPlay) {
    }
}
