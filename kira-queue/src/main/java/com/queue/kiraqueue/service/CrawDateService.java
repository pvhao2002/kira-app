package com.queue.kiraqueue.service;

import com.microsoft.playwright.Page;
import com.queue.kiraqueue.dto.EventHtml;
import com.queue.kiraqueue.util.Constants;
import com.queue.kiraqueue.util.PlaywrightUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.jsoup.Jsoup;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.logging.Level;

@Log
@Service
@RequiredArgsConstructor
public class CrawDateService {
    public static final String STATUS = "status";
    public static final String TEAM_NAME = "team_name";
    public static final String LEAGUE_NAME = "league_name";
    public static final String LOGO_URL = "logo_url";
    public static final String IN_PROGRESS = "in_progress";
    public static final String DONE = "done";
    public static final String TOTAL_EVENTS = "total_events";
    private final NamedParameterJdbcTemplate jdbcTemplate;
    private static final String SQL_CRAWL_DATE = """
            update crawl_date
            set status       = :status,
                total_events = :total_events
            where date = :date
            """;
    private static final String SQL_INSERT_LEAGUE = "insert ignore into leagues(league_name, logo_url, country) VALUES (:league_name, :logo_url, :country)";
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

    public void crawlDate(List<String> dates) {
        PlaywrightUtil.withPlaywright(dates, (page, mDates) -> mDates.forEach(date -> {
            log.info("Start crawl analystDate for date: " + date);
            long totalEvents = 0;
            var startTimes = System.currentTimeMillis();
            var paramsDate = new MapSqlParameterSource("date", date);
            var eventQueue = new ArrayList<EventHtml>();
            jdbcTemplate.update(SQL_CRAWL_DATE, paramsDate.addValue(STATUS, IN_PROGRESS).addValue(TOTAL_EVENTS, 0));
            try {
                page.navigate(Constants.AI_SCORE_URL + "%s".formatted(date));
                PlaywrightUtil.waitDomContentLoaded(page);
                var allBtn = page.locator("span.changeItem", new Page.LocatorOptions().setHasText("All"));
                allBtn.click();
                page.locator("span.sortByText", new Page.LocatorOptions().setHasText("Sort by time"))
                        .click();
                PlaywrightUtil.waitDomContentLoaded(page);
                crawlEvent(page, eventQueue);
                eventQueue.forEach(event -> {
                    jdbcTemplate.update(SQL_INSERT_LEAGUE, event.toParamInsertLeague());
                    jdbcTemplate.update(SQL_INSERT_TEAM, event.toParamInsertTeam(true));
                    jdbcTemplate.update(SQL_INSERT_TEAM, event.toParamInsertTeam(false));
                    var leagueId = jdbcTemplate.queryForObject(
                            "select league_id from leagues where league_name = :league_name",
                            new MapSqlParameterSource(LEAGUE_NAME, event.getLeagueName()),
                            Integer.class
                    );
                    var sqlTeam = "select team_id from teams where team_name = :team_name";
                    var homeId = jdbcTemplate.queryForObject(
                            sqlTeam,
                            new MapSqlParameterSource(TEAM_NAME, event.getHomeName()),
                            Integer.class
                    );
                    var awayId = jdbcTemplate.queryForObject(
                            sqlTeam,
                            new MapSqlParameterSource(TEAM_NAME, event.getAwayName()),
                            Integer.class
                    );
                    jdbcTemplate.update(SQL_INSERT_EVENT, event.toParamInsertEvent(leagueId, homeId, awayId));
                    var eventId = jdbcTemplate.queryForObject(
                            "select event_id from events where external_id = :exid",
                            new MapSqlParameterSource("exid", event.getExternalId()),
                            Long.class
                    );
                    jdbcTemplate.update(SQL_INSERT_EVENT_RESULT, event.toParamInsertEventResult(eventId));
                });
                totalEvents = eventQueue.stream().distinct().count();
                jdbcTemplate.update(SQL_CRAWL_DATE, paramsDate.addValue(STATUS, DONE).addValue(TOTAL_EVENTS, eventQueue.size()));
            } catch (Exception ex) {
                log.log(Level.WARNING, "Error during analystDate", ex);
                jdbcTemplate.update(SQL_CRAWL_DATE, paramsDate.addValue(STATUS, "failed"));
            } finally {
                log.info("Crawl analystDate for date: " + date + " has %d events done at %s took %.2f s".formatted(totalEvents, new Date().toString(), ((System.currentTimeMillis() - startTimes) / 1000.0)));
            }
        }));
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
                    var event = new EventHtml(m).withCountryName(countryName).withLeagueName(leagueName).withLeagueUrl(logo);
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
            page.waitForTimeout(120);
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
