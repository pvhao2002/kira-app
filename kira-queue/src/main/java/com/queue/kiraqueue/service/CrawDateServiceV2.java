package com.queue.kiraqueue.service;

import com.queue.kiraqueue.amqp.LogoUploadProducer;
import com.queue.kiraqueue.client.KiraCrawlClient;
import com.queue.kiraqueue.dto.crawl.CrawledMatchBundle;
import com.queue.kiraqueue.dto.crawl.CrawlEventDto;
import com.queue.kiraqueue.dto.crawl.CrawlEventResultDto;
import com.queue.kiraqueue.dto.crawl.CrawlLeagueDto;
import com.queue.kiraqueue.dto.crawl.CrawlTeamDto;
import com.queue.kiraqueue.util.JdbcBatchUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.logging.Level;
import java.util.stream.Collectors;

@Log
@Service
@RequiredArgsConstructor
public class CrawDateServiceV2 {

    public static final String STATUS = "status";
    public static final String IN_PROGRESS = "in_progress";
    public static final String DONE = "done";
    public static final String FAILED = "failed";
    public static final String TOTAL_EVENTS = "total_events";
    public static final String ERROR_MESSAGE = "error_message";

    private static final int CANCELLED_STATUS_ID = 12;

    private static final String SQL_ENSURE_CRAWL_DATE = """
            insert into crawl_date (date, status) values (:date, 'pending')
            on duplicate key update date = date
            """;

    private static final String SQL_CRAWL_DATE = """
            update crawl_date
            set status       = :status,
                total_events = :total_events,
                message      = :error_message
            where date = :date
            """;

    private static final String SQL_UPSERT_LEAGUE = """
            insert into leagues (league_name, logo_url, country, country_code_short,
                                 external_id, has_stats, slug, sport_id, color)
            values (:league_name, :logo_url, :country, :country_code_short,
                    :external_id, :has_stats, :slug, :sport_id, :color)
            on duplicate key update
                logo_url = values(logo_url),
                country = values(country),
                country_code_short = values(country_code_short),
                external_id = values(external_id),
                has_stats = values(has_stats),
                slug = values(slug),
                sport_id = values(sport_id),
                color = values(color)
            """;

    private static final String SQL_UPSERT_TEAM = """
            insert into teams (team_name, logo_url, external_id, sport_id)
            values (:team_name, :logo_url, :external_id, :sport_id)
            on duplicate key update
                logo_url = values(logo_url),
                external_id = values(external_id),
                sport_id = values(sport_id)
            """;

    private static final String SQL_UPSERT_EVENT = """
            insert into events (external_id, league_id, home_id, away_id,
                                event_name, event_date, status, status_id, link,
                                has_odds, has_odds_corner)
            values (:exid, :league_id, :home_id, :away_id,
                    :event_name, :event_date, :status, :status_id, :link,
                    :has_odds, :has_odds_corner)
            on duplicate key update
                league_id = values(league_id),
                home_id = values(home_id),
                away_id = values(away_id),
                event_name = values(event_name),
                event_date = values(event_date),
                status = values(status),
                status_id = values(status_id),
                link = values(link),
                has_odds = values(has_odds),
                has_odds_corner = values(has_odds_corner)
            """;

    private static final String SQL_UPSERT_EVENT_RESULT = """
            insert into event_result (event_id, ht_home_goal, ht_away_goal, ft_home_goal, ft_away_goal,
                                      ft_home_corner, ft_away_corner, ft_home_yellow_card, ft_away_yellow_card,
                                      ht_result, ht_goal_str, ft_result, ft_goal_str)
            values (:eventId, :htHomeGoal, :htAwayGoal, :ftHomeGoal, :ftAwayGoal,
                    :ftHomeCorner, :ftAwayCorner, :ftHomeYellowCard, :ftAwayYellowCard,
                    :htResult, :htGoalStr, :ftResult, :ftGoalStr)
            on duplicate key update
                ht_home_goal = values(ht_home_goal),
                ht_away_goal = values(ht_away_goal),
                ft_home_goal = values(ft_home_goal),
                ft_away_goal = values(ft_away_goal),
                ft_home_corner = values(ft_home_corner),
                ft_away_corner = values(ft_away_corner),
                ft_home_yellow_card = values(ft_home_yellow_card),
                ft_away_yellow_card = values(ft_away_yellow_card),
                ht_result = values(ht_result),
                ht_goal_str = values(ht_goal_str),
                ft_result = values(ft_result),
                ft_goal_str = values(ft_goal_str)
            """;

    private static final String SQL_SELECT_LEAGUES = """
            select league_id, league_name, external_id
            from leagues
            where league_name in (:names) or external_id in (:exids)
            """;

    private static final String SQL_SELECT_TEAMS = """
            select team_id, team_name, external_id
            from teams
            where team_name in (:names) or external_id in (:exids)
            """;

    private static final String SQL_SELECT_EVENT_IDS =
            "select event_id, external_id from events where external_id in (:exids)";

    private static final String SQL_UPSERT_EVENT_DATA_ISSUE = """
            insert into event_data_issue (event_id, issue_type, description, recorded_at)
            values (:eventId, :issueType, :description, :recordedAt)
            on duplicate key update description = values(description),
                                    recorded_at = values(recorded_at)
            """;

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final KiraCrawlClient kiraCrawlClient;
    private final LogoUploadProducer logoUploadProducer;

    public void crawlDate(List<String> dates) {
        if (CollectionUtils.isEmpty(dates)) {
            return;
        }

        jdbcTemplate.batchUpdate(
                SQL_ENSURE_CRAWL_DATE,
                dates.stream()
                        .map(date -> new MapSqlParameterSource("date", date))
                        .toArray(MapSqlParameterSource[]::new)
        );

        jdbcTemplate.batchUpdate(
                SQL_CRAWL_DATE,
                dates.stream()
                        .map(date -> new MapSqlParameterSource("date", date)
                                .addValue(STATUS, IN_PROGRESS)
                                .addValue(TOTAL_EVENTS, 0)
                                .addValue(ERROR_MESSAGE, null))
                        .toArray(MapSqlParameterSource[]::new)
        );

        var dateStatusUpdates = new ArrayList<MapSqlParameterSource>(dates.size());
        for (String date : dates) {
            log.info("Start crawlDateV2 for date: " + date);
            long startTime = System.currentTimeMillis();
            int totalEvents = 0;
            try {
                var response = kiraCrawlClient.fetchMatches(date);
                var events = response.events() == null ? List.<CrawledMatchBundle>of() : response.events();
                persistEvents(events);
                totalEvents = events.size();
                dateStatusUpdates.add(new MapSqlParameterSource("date", date)
                        .addValue(ERROR_MESSAGE, null)
                        .addValue(STATUS, DONE)
                        .addValue(TOTAL_EVENTS, totalEvents));
            } catch (Exception ex) {
                log.log(Level.WARNING, "Error during crawlDateV2 for date=" + date, ex);
                dateStatusUpdates.add(new MapSqlParameterSource("date", date)
                        .addValue(STATUS, FAILED)
                        .addValue(TOTAL_EVENTS, 0)
                        .addValue(ERROR_MESSAGE, ex.getMessage()));
            } finally {
                log.info("CrawlDateV2 for date=%s has %d events, took %.2f s".formatted(
                        date, totalEvents, (System.currentTimeMillis() - startTime) / 1000.0));
            }
        }

        if (!dateStatusUpdates.isEmpty()) {
            jdbcTemplate.batchUpdate(SQL_CRAWL_DATE, dateStatusUpdates.toArray(MapSqlParameterSource[]::new));
        }
    }

    private void persistEvents(List<CrawledMatchBundle> events) {
        if (CollectionUtils.isEmpty(events)) {
            return;
        }

        Map<String, MapSqlParameterSource> leagueParamsByName = new LinkedHashMap<>();
        for (CrawledMatchBundle bundle : events) {
            CrawlLeagueDto league = bundle.league();
            if (league == null || !StringUtils.hasText(league.leagueName())) {
                continue;
            }
            leagueParamsByName.putIfAbsent(league.leagueName(), toLeagueParams(league));
        }
        JdbcBatchUtils.batchInsertSafe(jdbcTemplate, SQL_UPSERT_LEAGUE, new ArrayList<>(leagueParamsByName.values()));

        Map<String, MapSqlParameterSource> teamParamsByName = new LinkedHashMap<>();
        for (CrawledMatchBundle bundle : events) {
            addTeamParams(teamParamsByName, bundle.homeTeam());
            addTeamParams(teamParamsByName, bundle.awayTeam());
        }
        JdbcBatchUtils.batchInsertSafe(jdbcTemplate, SQL_UPSERT_TEAM, new ArrayList<>(teamParamsByName.values()));

        List<String> leagueNames = new ArrayList<>(leagueParamsByName.keySet());
        List<String> leagueExternalIds = leagueParamsByName.values().stream()
                .map(p -> p.getValue("external_id"))
                .filter(Objects::nonNull)
                .map(Object::toString)
                .filter(StringUtils::hasText)
                .distinct()
                .toList();
        Map<String, Integer> leagueIdByExternalId = new HashMap<>();
        Map<String, Integer> leagueIdByName = new HashMap<>();
        loadLeagueIds(leagueNames, leagueExternalIds, leagueIdByName, leagueIdByExternalId);

        List<String> teamNames = new ArrayList<>(teamParamsByName.keySet());
        List<String> teamExternalIds = teamParamsByName.values().stream()
                .map(p -> p.getValue("external_id"))
                .filter(Objects::nonNull)
                .map(Object::toString)
                .filter(StringUtils::hasText)
                .distinct()
                .toList();
        Map<String, Integer> teamIdByExternalId = new HashMap<>();
        Map<String, Integer> teamIdByName = new HashMap<>();
        loadTeamIds(teamNames, teamExternalIds, teamIdByName, teamIdByExternalId);

        logoUploadProducer.enqueuePendingLeagues(leagueIdByName.values());
        logoUploadProducer.enqueuePendingLeagues(leagueIdByExternalId.values());
        logoUploadProducer.enqueuePendingTeams(teamIdByName.values());
        logoUploadProducer.enqueuePendingTeams(teamIdByExternalId.values());

        List<MapSqlParameterSource> eventParams = new ArrayList<>();
        for (CrawledMatchBundle bundle : events) {
            CrawlEventDto event = bundle.event();
            CrawlLeagueDto league = bundle.league();
            CrawlTeamDto homeTeam = bundle.homeTeam();
            CrawlTeamDto awayTeam = bundle.awayTeam();
            if (event == null || !StringUtils.hasText(event.externalId())) {
                continue;
            }
            Integer leagueId = resolveLeagueId(league, leagueIdByExternalId, leagueIdByName);
            Integer homeId = resolveTeamId(homeTeam, teamIdByExternalId, teamIdByName);
            Integer awayId = resolveTeamId(awayTeam, teamIdByExternalId, teamIdByName);
            eventParams.add(toEventParams(event, leagueId, homeId, awayId));
        }
        JdbcBatchUtils.batchInsertSafe(jdbcTemplate, SQL_UPSERT_EVENT, eventParams);

        List<String> exIds = eventParams.stream()
                .map(p -> p.getValue("exid"))
                .filter(Objects::nonNull)
                .map(Object::toString)
                .toList();
        Map<String, Long> eventIdByExId = jdbcTemplate.query(SQL_SELECT_EVENT_IDS, Map.of("exids", exIds),
                        (rs, rn) -> new Object[]{rs.getString("external_id"), rs.getLong("event_id")})
                .stream()
                .collect(Collectors.toMap(arr -> (String) arr[0], arr -> (Long) arr[1], (a, b) -> a));

        List<MapSqlParameterSource> resultParams = new ArrayList<>();
        for (CrawledMatchBundle bundle : events) {
            CrawlEventDto event = bundle.event();
            if (event == null || !StringUtils.hasText(event.externalId())) {
                continue;
            }
            Long eventId = eventIdByExId.get(event.externalId());
            if (eventId == null) {
                continue;
            }
            resultParams.add(toEventResultParams(eventId, bundle.result()));
            if (isCancelled(event)) {
                recordCancelledEvent(eventId);
            }
        }
        JdbcBatchUtils.batchInsertSafe(jdbcTemplate, SQL_UPSERT_EVENT_RESULT, resultParams);
    }

    private void loadLeagueIds(
            List<String> leagueNames,
            List<String> leagueExternalIds,
            Map<String, Integer> leagueIdByName,
            Map<String, Integer> leagueIdByExternalId
    ) {
        if (leagueNames.isEmpty() && leagueExternalIds.isEmpty()) {
            return;
        }
        jdbcTemplate.query(
                SQL_SELECT_LEAGUES,
                Map.of(
                        "names", leagueNames.isEmpty() ? List.of("") : leagueNames,
                        "exids", leagueExternalIds.isEmpty() ? List.of("") : leagueExternalIds
                ),
                (rs, rn) -> {
                    leagueIdByName.put(rs.getString("league_name"), rs.getInt("league_id"));
                    String externalId = rs.getString("external_id");
                    if (StringUtils.hasText(externalId)) {
                        leagueIdByExternalId.put(externalId, rs.getInt("league_id"));
                    }
                    return null;
                }
        );
    }

    private void loadTeamIds(
            List<String> teamNames,
            List<String> teamExternalIds,
            Map<String, Integer> teamIdByName,
            Map<String, Integer> teamIdByExternalId
    ) {
        if (teamNames.isEmpty() && teamExternalIds.isEmpty()) {
            return;
        }
        jdbcTemplate.query(
                SQL_SELECT_TEAMS,
                Map.of(
                        "names", teamNames.isEmpty() ? List.of("") : teamNames,
                        "exids", teamExternalIds.isEmpty() ? List.of("") : teamExternalIds
                ),
                (rs, rn) -> {
                    teamIdByName.put(rs.getString("team_name"), rs.getInt("team_id"));
                    String externalId = rs.getString("external_id");
                    if (StringUtils.hasText(externalId)) {
                        teamIdByExternalId.put(externalId, rs.getInt("team_id"));
                    }
                    return null;
                }
        );
    }

    private static void addTeamParams(Map<String, MapSqlParameterSource> teamParamsByName, CrawlTeamDto team) {
        if (team == null || !StringUtils.hasText(team.teamName())) {
            return;
        }
        teamParamsByName.putIfAbsent(team.teamName(), toTeamParams(team));
    }

    private static Integer resolveLeagueId(
            CrawlLeagueDto league,
            Map<String, Integer> leagueIdByExternalId,
            Map<String, Integer> leagueIdByName
    ) {
        if (league == null) {
            return null;
        }
        if (StringUtils.hasText(league.externalId())) {
            Integer id = leagueIdByExternalId.get(league.externalId());
            if (id != null) {
                return id;
            }
        }
        return leagueIdByName.get(league.leagueName());
    }

    private static Integer resolveTeamId(
            CrawlTeamDto team,
            Map<String, Integer> teamIdByExternalId,
            Map<String, Integer> teamIdByName
    ) {
        if (team == null) {
            return null;
        }
        if (StringUtils.hasText(team.externalId())) {
            Integer id = teamIdByExternalId.get(team.externalId());
            if (id != null) {
                return id;
            }
        }
        return teamIdByName.get(team.teamName());
    }

    private static MapSqlParameterSource toLeagueParams(CrawlLeagueDto league) {
        return new MapSqlParameterSource()
                .addValue("league_name", league.leagueName())
                .addValue("logo_url", league.logoUrl())
                .addValue("country", league.country())
                .addValue("country_code_short", league.countryCodeShort())
                .addValue("external_id", league.externalId())
                .addValue("has_stats", league.hasStats())
                .addValue("slug", league.slug())
                .addValue("sport_id", league.sportId())
                .addValue("color", league.color());
    }

    private static MapSqlParameterSource toTeamParams(CrawlTeamDto team) {
        return new MapSqlParameterSource()
                .addValue("team_name", team.teamName())
                .addValue("logo_url", team.logoUrl())
                .addValue("external_id", team.externalId())
                .addValue("sport_id", team.sportId());
    }

    private static MapSqlParameterSource toEventParams(
            CrawlEventDto event,
            Integer leagueId,
            Integer homeId,
            Integer awayId
    ) {
        return new MapSqlParameterSource()
                .addValue("exid", event.externalId())
                .addValue("league_id", leagueId)
                .addValue("home_id", homeId)
                .addValue("away_id", awayId)
                .addValue("event_name", event.eventName())
                .addValue("event_date", parseEventDate(event.eventDate()))
                .addValue("status", defaultStatus(event.status()))
                .addValue("status_id", event.statusId())
                .addValue("link", event.link())
                .addValue("has_odds", Boolean.TRUE.equals(event.hasOdds()))
                .addValue("has_odds_corner", Boolean.TRUE.equals(event.hasOddsCorner()));
    }

    private static MapSqlParameterSource toEventResultParams(Long eventId, CrawlEventResultDto result) {
        if (result == null) {
            return new MapSqlParameterSource("eventId", eventId);
        }
        return new MapSqlParameterSource()
                .addValue("eventId", eventId)
                .addValue("htHomeGoal", nonNegative(result.htHomeGoal()))
                .addValue("htAwayGoal", nonNegative(result.htAwayGoal()))
                .addValue("ftHomeGoal", nonNegative(result.ftHomeGoal()))
                .addValue("ftAwayGoal", nonNegative(result.ftAwayGoal()))
                .addValue("ftHomeCorner", nonNegative(result.ftHomeCorner()))
                .addValue("ftAwayCorner", nonNegative(result.ftAwayCorner()))
                .addValue("ftHomeYellowCard", nonNegative(result.ftHomeYellowCard()))
                .addValue("ftAwayYellowCard", nonNegative(result.ftAwayYellowCard()))
                .addValue("htResult", result.htResult())
                .addValue("htGoalStr", result.htGoalStr())
                .addValue("ftResult", result.ftResult())
                .addValue("ftGoalStr", result.ftGoalStr());
    }

    private static Integer nonNegative(Integer value) {
        return value == null ? null : Math.max(0, value);
    }

    private static LocalDateTime parseEventDate(String eventDate) {
        if (!StringUtils.hasText(eventDate)) {
            return null;
        }
        return OffsetDateTime.parse(eventDate).toLocalDateTime();
    }

    private static String defaultStatus(String status) {
        return StringUtils.hasText(status) ? status : "-";
    }

    private static boolean isCancelled(CrawlEventDto event) {
        if (event.statusId() != null && event.statusId() == CANCELLED_STATUS_ID) {
            return true;
        }
        return "Canceled".equalsIgnoreCase(event.status())
                || "CANCELLED".equalsIgnoreCase(event.status());
    }

    private void recordCancelledEvent(Long eventId) {
        jdbcTemplate.update(
                SQL_UPSERT_EVENT_DATA_ISSUE,
                new MapSqlParameterSource("eventId", eventId)
                        .addValue("issueType", "cancelled")
                        .addValue("description", "Provider status is CANCELLED")
                        .addValue("recordedAt", LocalDateTime.now())
        );
    }
}
