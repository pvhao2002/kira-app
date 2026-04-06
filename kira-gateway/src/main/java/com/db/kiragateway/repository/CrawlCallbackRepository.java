package com.db.kiragateway.repository;

import com.db.kiragateway.config.db.ReadDB;
import com.db.kiragateway.config.db.WriteDB;
import com.db.kiragateway.dto.*;
import com.db.kiragateway.util.DateUtil;
import com.db.kiragateway.util.JdbcBatchUtils;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.*;
import java.util.logging.Logger;
import java.util.stream.Collectors;

@Repository
public class CrawlCallbackRepository {

    private static final Logger log = Logger.getLogger(CrawlCallbackRepository.class.getName());
    private final NamedParameterJdbcTemplate writeJdbc;
    private final JdbcClient readClient;

    public CrawlCallbackRepository(@WriteDB NamedParameterJdbcTemplate writeJdbc,
                                   @ReadDB JdbcClient readClient) {
        this.writeJdbc = writeJdbc;
        this.readClient = readClient;
    }

    // ─── crawl_date ───

    private static final String SQL_UPDATE_CRAWL_DATE = """
            UPDATE crawl_date
            SET status       = :status,
                total_events = :total_events,
                message      = :message
            WHERE date = :date
            """;

    public void updateCrawlDateStatus(String date, String status, int totalEvents, String message) {
        writeJdbc.update(SQL_UPDATE_CRAWL_DATE,
                new MapSqlParameterSource("date", date)
                        .addValue("status", status)
                        .addValue("total_events", totalEvents)
                        .addValue("message", message));
    }

    // ─── leagues ───

    private static final String SQL_INSERT_LEAGUE =
            "INSERT IGNORE INTO leagues(league_name, logo_url, country) VALUES (:league_name, :logo_url, :country)";

    private static final String SQL_SELECT_LEAGUES =
            "SELECT league_id, league_name FROM leagues WHERE league_name IN (:names)";

    public void batchInsertLeagues(List<MapSqlParameterSource> params) {
        JdbcBatchUtils.batchInsertSafe(writeJdbc, SQL_INSERT_LEAGUE, params);
    }

    public Map<String, Integer> selectLeagueIdsByName(List<String> names) {
        if (names.isEmpty()) return Map.of();
        return writeJdbc.query(SQL_SELECT_LEAGUES, Map.of("names", names),
                        (rs, rn) -> new Object[]{rs.getString("league_name"), rs.getInt("league_id")})
                .stream()
                .collect(Collectors.toMap(a -> (String) a[0], a -> (Integer) a[1], (x, y) -> x));
    }

    // ─── teams ───

    private static final String SQL_INSERT_TEAM =
            "INSERT IGNORE INTO teams(team_name, logo_url) VALUES (:team_name, :logo_url)";

    private static final String SQL_SELECT_TEAMS =
            "SELECT team_id, team_name FROM teams WHERE team_name IN (:names)";

    public void batchInsertTeams(List<MapSqlParameterSource> params) {
        JdbcBatchUtils.batchInsertSafe(writeJdbc, SQL_INSERT_TEAM, params);
    }

    public Map<String, Integer> selectTeamIdsByName(List<String> names) {
        if (names.isEmpty()) return Map.of();
        return writeJdbc.query(SQL_SELECT_TEAMS, Map.of("names", names),
                        (rs, rn) -> new Object[]{rs.getString("team_name"), rs.getInt("team_id")})
                .stream()
                .collect(Collectors.toMap(a -> (String) a[0], a -> (Integer) a[1], (x, y) -> x));
    }

    // ─── events ───

    private static final String SQL_INSERT_EVENT = """
            INSERT IGNORE INTO events(external_id, league_id, home_id, away_id, event_name, event_date, status, link)
            VALUES (:exid, :league_id, :home_id, :away_id, :event_name, :event_date, :status, :link)
            """;

    private static final String SQL_SELECT_EVENT_IDS =
            "SELECT event_id, external_id FROM events WHERE external_id IN (:exids)";

    public void batchInsertEvents(List<MapSqlParameterSource> params) {
        JdbcBatchUtils.batchInsertSafe(writeJdbc, SQL_INSERT_EVENT, params);
    }

    public Map<String, Long> selectEventIdsByExternalId(List<String> externalIds) {
        if (externalIds.isEmpty()) return Map.of();
        return writeJdbc.query(SQL_SELECT_EVENT_IDS, Map.of("exids", externalIds),
                        (rs, rn) -> new Object[]{rs.getString("external_id"), rs.getLong("event_id")})
                .stream()
                .collect(Collectors.toMap(a -> (String) a[0], a -> (Long) a[1], (x, y) -> x));
    }

    // ─── event_result ───

    private static final String SQL_INSERT_EVENT_RESULT = """
            INSERT IGNORE INTO event_result(event_id, ht_home_goal, ht_away_goal, ft_home_goal, ft_away_goal,
                                     ft_home_corner, ft_away_corner, ht_result, ht_goal_str, ft_result, ft_goal_str)
            VALUES (:eventId, :htHomeGoal, :htAwayGoal, :ftHomeGoal, :ftAwayGoal, :ftHomeCorner, :ftAwayCorner,
                    :htResult, :htGoalStr, :ftResult, :ftGoalStr)
            """;

    public void batchInsertEventResults(List<MapSqlParameterSource> params) {
        JdbcBatchUtils.batchInsertSafe(writeJdbc, SQL_INSERT_EVENT_RESULT, params);
    }

    private static final String SQL_UPDATE_EVENT_RESULT_STATS = """
            UPDATE event_result SET
                ht_home_corner = :ht_home_corner, ht_away_corner = :ht_away_corner,
                ht_home_yellow_card = :ht_home_yellow_card, ht_away_yellow_card = :ht_away_yellow_card,
                ht_home_foul = :ht_home_foul, ht_away_foul = :ht_away_foul,
                ht_home_offside = :ht_home_offside, ht_away_offside = :ht_away_offside,
                ht_home_total_shot = :ht_home_total_shot, ht_away_total_shot = :ht_away_total_shot,
                ht_home_shot_on_target = :ht_home_shot_on_target, ht_away_shot_on_target = :ht_away_shot_on_target,
                ft_home_corner = :ft_home_corner, ft_away_corner = :ft_away_corner,
                ft_home_yellow_card = :ft_home_yellow_card, ft_away_yellow_card = :ft_away_yellow_card,
                ft_home_foul = :ft_home_foul, ft_away_foul = :ft_away_foul,
                ft_home_offside = :ft_home_offside, ft_away_offside = :ft_away_offside,
                ft_home_total_shot = :ft_home_total_shot, ft_away_total_shot = :ft_away_total_shot,
                ft_home_shot_on_target = :ft_home_shot_on_target, ft_away_shot_on_target = :ft_away_shot_on_target
            WHERE event_id = :event_id
            """;

    public void updateEventStats(long eventId, Map<String, int[]> htStats, Map<String, int[]> ftStats) {
        var p = new MapSqlParameterSource("event_id", eventId);
        for (String key : List.of("corner", "yellow_card", "foul", "offside", "total_shot", "shot_on_target")) {
            int[] htVal = htStats.getOrDefault(key, new int[]{0, 0});
            int[] ftVal = ftStats.getOrDefault(key, new int[]{0, 0});
            p.addValue("ht_home_" + key, htVal[0]);
            p.addValue("ht_away_" + key, htVal[1]);
            p.addValue("ft_home_" + key, ftVal[0]);
            p.addValue("ft_away_" + key, ftVal[1]);
        }
        writeJdbc.update(SQL_UPDATE_EVENT_RESULT_STATS, p);
    }

    // ─── event_odds + timeline ───

    private static final String SQL_DELETE_EVENT_ODDS = "DELETE FROM event_odds WHERE event_id = :event_id";
    private static final String SQL_DELETE_EVENT_ODDS_TIMELINE = "DELETE FROM event_odds_timeline WHERE event_id = :event_id";

    private static final String SQL_INSERT_EVENT_ODDS = """
            INSERT INTO event_odds(event_id, type, market, line, price_a, price_b)
            VALUES (:event_id, :type, :market, :line, :price_a, :price_b)
            ON DUPLICATE KEY UPDATE line = VALUES(line), price_a = VALUES(price_a), price_b = VALUES(price_b)
            """;

    private static final String SQL_INSERT_EVENT_ODDS_TIMELINE = """
            INSERT INTO event_odds_timeline(event_id, market, line, price_a, price_b, match_minute, crawled_at)
            VALUES (:event_id, :market, :line, :price_a, :price_b, :match_minute, :crawled_at)
            """;

    public void deleteOddsForEvent(long eventId) {
        var params = Map.<String, Object>of("event_id", eventId);
        writeJdbc.update(SQL_DELETE_EVENT_ODDS_TIMELINE, params);
        writeJdbc.update(SQL_DELETE_EVENT_ODDS, params);
    }

    public void persistOddsForMarket(long eventId, String market, List<OddsTimelineItemDTO> timeline) {
        if (timeline == null || timeline.isEmpty()) return;

        var now = LocalDateTime.now();
        var timelineParams = timeline.stream()
                .map(t -> {
                    LocalDateTime crawledAt = (t.date() != null && !t.date().isBlank())
                            ? DateUtil.parseOddDate(t.date(), now)
                            : now;
                    return new MapSqlParameterSource()
                            .addValue("event_id", eventId)
                            .addValue("market", market)
                            .addValue("line", t.line())
                            .addValue("price_a", t.priceA())
                            .addValue("price_b", t.priceB())
                            .addValue("match_minute", t.matchMinute())
                            .addValue("crawled_at", crawledAt);
                })
                .toList();
        JdbcBatchUtils.batchInsertSafe(writeJdbc, SQL_INSERT_EVENT_ODDS_TIMELINE, timelineParams);

        var first = timeline.stream().filter(t -> t.date() != null).findFirst().orElse(timeline.getFirst());
        var last = timeline.getLast();

        writeJdbc.update(SQL_INSERT_EVENT_ODDS, toEventOddsParams(eventId, "open", market, last));
        writeJdbc.update(SQL_INSERT_EVENT_ODDS, toEventOddsParams(eventId, "pre-match", market, first));

        timeline.stream()
                .filter(t -> t.matchMinute() != null && t.matchMinute().trim().equalsIgnoreCase("ht"))
                .findFirst()
                .ifPresent(ht -> writeJdbc.update(SQL_INSERT_EVENT_ODDS, toEventOddsParams(eventId, "half-time", market, ht)));
    }

    private MapSqlParameterSource toEventOddsParams(long eventId, String type, String market, OddsTimelineItemDTO t) {
        return new MapSqlParameterSource()
                .addValue("event_id", eventId)
                .addValue("type", type)
                .addValue("market", market)
                .addValue("line", t.line())
                .addValue("price_a", t.priceA())
                .addValue("price_b", t.priceB());
    }

    // ─── event_crawl_failed ───

    private static final String SQL_INSERT_CRAWL_FAIL = """
            INSERT INTO event_crawl_failed(event_id, type, message)
            VALUES (:eventId, :type, :message)
            ON DUPLICATE KEY UPDATE message = VALUES(message)
            """;

    private static final String SQL_DELETE_CRAWL_FAIL =
            "DELETE FROM event_crawl_failed WHERE event_id = :eventId";

    public void insertCrawlFail(long eventId, String type, String message) {
        writeJdbc.update(SQL_INSERT_CRAWL_FAIL,
                Map.of("eventId", eventId, "type", type, "message", message));
    }

    public void deleteCrawlFail(long eventId) {
        writeJdbc.update(SQL_DELETE_CRAWL_FAIL, Map.of("eventId", eventId));
    }

    // ─── event info ───

    public Optional<EventInfoResponse> findEventInfo(long eventId) {
        return readClient
                .sql("SELECT event_id, link, event_name FROM events WHERE event_id = :eid")
                .param("eid", eventId)
                .query((rs, rn) -> new EventInfoResponse(
                        rs.getLong("event_id"),
                        rs.getString("link"),
                        rs.getString("event_name")))
                .optional();
    }
}
