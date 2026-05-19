package com.queue.kiraqueue.service;

import com.microsoft.playwright.Page;
import com.queue.kiraqueue.dto.EventHtml;
import com.queue.kiraqueue.util.Constants;
import com.queue.kiraqueue.util.JdbcBatchUtils;
import com.queue.kiraqueue.util.PlaywrightUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.jsoup.Jsoup;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.logging.Level;
import java.util.stream.Collectors;

@Log
@Service
@RequiredArgsConstructor
public class CrawDateService {
    public static final String STATUS = "status";
    public static final String TEAM_NAME = "team_name";
    public static final String LEAGUE_NAME = "league_name";
    public static final String LOGO_URL = "logo_url";
    public static final String COUNTRY_CODE_SHORT = "country_code_short";
    public static final String IN_PROGRESS = "in_progress";
    public static final String DONE = "done";
    public static final String FAILED = "failed";
    public static final String TOTAL_EVENTS = "total_events";
    public static final String ERROR_MESSAGE = "error_message";
    private final NamedParameterJdbcTemplate jdbcTemplate;
    private static final String SQL_CRAWL_DATE = """
            update crawl_date
            set status       = :status,
                total_events = :total_events,
                message      = :error_message
            where date = :date
            """;
    private static final String SQL_INSERT_LEAGUE = """
            insert ignore into leagues(league_name, logo_url, country, country_code_short)
            VALUES (:league_name, :logo_url, :country, :country_code_short)
            """;
    private static final String SQL_INSERT_EVENT = """
            insert ignore into events(external_id, league_id, home_id, away_id, event_name, event_date, status, link)
            VALUES (:exid, :league_id, :home_id, :away_id, :event_name, :event_date, :status, :link)
            """;
    private static final String SQL_INSERT_EVENT_RESULT = """
            insert ignore into event_result(event_id, ht_home_goal, ht_away_goal, ft_home_goal, ft_away_goal, ft_home_corner,
                                     ft_away_corner, ht_result, ht_goal_str, ft_result, ft_goal_str)
            VALUES (:eventId, :htHomeGoal, :htAwayGoal, :ftHomeGoal, :ftAwayGoal, :ftHomeCorner, :ftAwayCorner,
                    :htResult, :htGoalStr, :ftResult, :ftGoalStr)
            """;
    private static final String SQL_INSERT_TEAM = "insert ignore into teams(team_name, logo_url) VALUES (:team_name, :logo_url)";
    private static final String SQL_SELECT_LEAGUES = "select league_id, league_name from leagues where league_name in (:names)";
    private static final String SQL_SELECT_TEAMS = "select team_id, team_name from teams where team_name in (:names)";
    private static final String SQL_SELECT_EVENT_IDS = "select event_id, external_id from events where external_id in (:exids)";

    public void crawlDate(List<String> dates) {
        if (CollectionUtils.isEmpty(dates)) {
            return;
        }

        jdbcTemplate.batchUpdate(
                SQL_CRAWL_DATE,
                dates.stream()
                        .map(date -> new MapSqlParameterSource("date", date)
                                .addValue(STATUS, IN_PROGRESS)
                                .addValue(TOTAL_EVENTS, 0)
                                .addValue(ERROR_MESSAGE, null))
                        .toArray(MapSqlParameterSource[]::new)
        );

        PlaywrightUtil.withPlaywright(dates, (page, mDates) -> {
            var dateStatusUpdates = new ArrayList<MapSqlParameterSource>(mDates.size());

            mDates.forEach(date -> {
                log.info("Start crawl analystDate for date: " + date);
                long totalEvents = 0;
                var startTimes = System.currentTimeMillis();
                var eventQueue = new ArrayList<EventHtml>();
                try {
                    page.navigate(Constants.AI_SCORE_URL + "%s".formatted(date));
                    var allBtn = page.locator("span.changeItem", new Page.LocatorOptions().setHasText("All"));
                    allBtn.click();
                    page.locator("span.sortByText", new Page.LocatorOptions().setHasText("Sort by time"))
                            .click();
                    crawlEvent(page, eventQueue);
                    List<EventHtml> distinctEvents = eventQueue.stream().distinct().toList();
                    persistEvents(distinctEvents);
                    totalEvents = distinctEvents.size();
                    dateStatusUpdates.add(new MapSqlParameterSource("date", date)
                            .addValue(ERROR_MESSAGE, null)
                            .addValue(STATUS, DONE)
                            .addValue(TOTAL_EVENTS, distinctEvents.size()));
                } catch (Exception ex) {
                    log.log(Level.WARNING, "Error during analystDate", ex);
                    dateStatusUpdates.add(new MapSqlParameterSource("date", date)
                            .addValue(STATUS, FAILED)
                            .addValue(TOTAL_EVENTS, 0)
                            .addValue(ERROR_MESSAGE, ex.getMessage()));
                } finally {
                    log.info("Crawl analystDate for date: " + date + " has %d events done at %s took %.2f s".formatted(totalEvents, new Date().toString(), ((System.currentTimeMillis() - startTimes) / 1000.0)));
                }
            });

            if (!dateStatusUpdates.isEmpty()) {
                jdbcTemplate.batchUpdate(SQL_CRAWL_DATE, dateStatusUpdates.toArray(MapSqlParameterSource[]::new));
            }
        }, ex -> {
            log.log(Level.WARNING, "Error initializing Playwright for analystDate batch", ex);
            var failedParams = dates.stream()
                    .map(date -> new MapSqlParameterSource("date", date)
                            .addValue(STATUS, FAILED)
                            .addValue(TOTAL_EVENTS, 0)
                            .addValue(ERROR_MESSAGE, ex.getMessage()))
                    .toArray(MapSqlParameterSource[]::new);
            if (failedParams.length > 0) {
                jdbcTemplate.batchUpdate(SQL_CRAWL_DATE, failedParams);
            }
        });
    }

    /**
     * Batch persist: insert leagues/teams in batch, bulk select ids, then batch insert events and event_result.
     */
    private void persistEvents(List<EventHtml> events) {
        if (CollectionUtils.isEmpty(events)) {
            return;
        }
        // 1. Unique leagues (first occurrence per league_name)
        Map<String, MapSqlParameterSource> leagueParamsByName = new LinkedHashMap<>();
        for (EventHtml e : events) {
            leagueParamsByName.putIfAbsent(e.getLeagueName(), e.toParamInsertLeague());
        }
        List<MapSqlParameterSource> leagueParams = new ArrayList<>(leagueParamsByName.values());
        JdbcBatchUtils.batchInsertSafe(jdbcTemplate, SQL_INSERT_LEAGUE, leagueParams);

        // 2. Unique teams (home + away, first occurrence per team_name)
        Map<String, MapSqlParameterSource> teamParamsByName = new LinkedHashMap<>();
        for (EventHtml e : events) {
            teamParamsByName.putIfAbsent(e.getHomeName(), e.toParamInsertTeam(true));
            teamParamsByName.putIfAbsent(e.getAwayName(), e.toParamInsertTeam(false));
        }
        List<MapSqlParameterSource> teamParams = new ArrayList<>(teamParamsByName.values());
        JdbcBatchUtils.batchInsertSafe(jdbcTemplate, SQL_INSERT_TEAM, teamParams);

        // 3. Bulk select league_id, team_id
        List<String> leagueNames = new ArrayList<>(leagueParamsByName.keySet());
        Map<String, Integer> leagueIdByName = jdbcTemplate.query(SQL_SELECT_LEAGUES, Map.of("names", leagueNames),
                        (rs, rn) -> new Object[]{rs.getString(LEAGUE_NAME), rs.getInt("league_id")})
                .stream()
                .collect(Collectors.toMap(arr -> (String) arr[0], arr -> (Integer) arr[1], (a, b) -> a));

        List<String> teamNames = new ArrayList<>(teamParamsByName.keySet());
        Map<String, Integer> teamIdByName = jdbcTemplate.query(SQL_SELECT_TEAMS, Map.of("names", teamNames),
                        (rs, rn) -> new Object[]{rs.getString(TEAM_NAME), rs.getInt("team_id")})
                .stream()
                .collect(Collectors.toMap(arr -> (String) arr[0], arr -> (Integer) arr[1], (a, b) -> a));

        // 4. Batch insert events
        List<MapSqlParameterSource> eventParams = events.stream()
                .map(e -> e.toParamInsertEvent(
                        leagueIdByName.get(e.getLeagueName()),
                        teamIdByName.get(e.getHomeName()),
                        teamIdByName.get(e.getAwayName())))
                .toList();
        JdbcBatchUtils.batchInsertSafe(jdbcTemplate, SQL_INSERT_EVENT, eventParams);

        // 5. Bulk select event_id by external_id
        List<String> exIds = events.stream().map(EventHtml::getExternalId).toList();
        Map<String, Long> eventIdByExId = jdbcTemplate.query(SQL_SELECT_EVENT_IDS, Map.of("exids", exIds),
                        (rs, rn) -> new Object[]{rs.getString("external_id"), rs.getLong("event_id")})
                .stream()
                .collect(Collectors.toMap(arr -> (String) arr[0], arr -> (Long) arr[1], (a, b) -> a));

        // 6. Batch insert event_result
        List<MapSqlParameterSource> resultParams = events.stream()
                .map(e -> e.toParamInsertEventResult(eventIdByExId.get(e.getExternalId())))
                .toList();
        JdbcBatchUtils.batchInsertSafe(jdbcTemplate, SQL_INSERT_EVENT_RESULT, resultParams);
    }

    private void crawlEvent(Page page, ArrayList<EventHtml> eventQueue) {
        final int scrollStep = 800;
        final int maxUnchanged = 5;
        int unchangedCount = 0;
        String previousKey = null;

        while (unchangedCount < maxUnchanged) {
            var doc = Jsoup.parse(page.content(), Constants.AI_SCORE_URL);
            var items = doc.select(".vue-recycle-scroller__item-view");
            if (items.isEmpty()) {
                break;
            }
            int addedThisRound = 0;

            for (var item : items) {
                var countryName = item.select(".country-name").text();
                var compeName = item.select(".compe-name").text();
                var leagueName = "%s %s".formatted(
                        countryName,
                        compeName
                );
                String logo = PlaywrightUtil.getImageFromStyleBackgroundImage(page, "i.country-logo.squareLogo");

                var matches = item.select("a.match-container");
                for (var m : matches) {
                    var event = new EventHtml(m).withCountryName(countryName.replace(":", "")).withLeagueName(leagueName).withLeagueUrl(logo);
                    if (event.getEventDate() == null) {
                        continue;
                    }
                    eventQueue.add(event);
                    addedThisRound++;
                }
            }

            String currentKey = getLastKey(page);
            if (currentKey == null || Objects.equals(previousKey, currentKey) || addedThisRound == 0) {
                unchangedCount++;
            } else {
                unchangedCount = 0;
            }
            previousKey = currentKey;

            page.evaluate("window.scrollBy(0, %d)".formatted(scrollStep));
            page.waitForTimeout(1000);
        }
    }


    private String getLastKey(Page page) {
        return (String) page.evaluate("""
                    () => {
                        const items = document.querySelectorAll('.vue-recycle-scroller__item-view a.match-container');
                        if (!items.length) return null;
                        return items[items.length - 1]
                            .innerText.replace(/\\s+/g, ' ')
                            .trim()
                            .toLowerCase();
                    }
                """);
    }
}
