package com.queue.kiraqueue.service;

import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.LoadState;
import com.queue.kiraqueue.dto.EventHtml;
import com.queue.kiraqueue.util.Constants;
import com.queue.kiraqueue.util.DateUtil;
import com.queue.kiraqueue.util.JdbcBatchUtils;
import com.queue.kiraqueue.util.PlaywrightUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.jsoup.Jsoup;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.logging.Level;

@Log
@Service
@RequiredArgsConstructor
public class CrawDateService {
    private static final long MAX_WAIT_TIME = 30_000;
    private static final String STATUS = "status";
    private static final String MATCH_BOX_SELECTOR = ".match-box";
    private static final String INSERT_SQL_EVENT_ANALYST = """
            insert into event_analyst(event_name
            , home_team
            , away_team
            , league_name
            , event_date
            , ht_home_score
            , ht_away_score
            , ft_home_score
            , ft_away_score
            , ht_score_str
            , ft_score_str
            , home_corner
            , away_corner
            , corner_str
            , link)
            values (:event_name
            , :home_team
            , :away_team
            , :league_name
            , :event_date
            , :ht_home_score
            , :ht_away_score
            , :ft_home_score
            , :ft_away_score
            , :ht_score_str
            , :ft_score_str
            , :home_corner
            , :away_corner
            , :corner_str
            , :detail_link)
            on duplicate key update
                home_team = values(home_team),
                away_team = values(away_team),
                league_name = values(league_name),
                ht_home_score = values(ht_home_score),
                ht_away_score = values(ht_away_score),
                ft_home_score = values(ft_home_score),
                ft_away_score = values(ft_away_score),
                ht_score_str = values(ht_score_str),
                ft_score_str = values(ft_score_str),
                home_corner = values(home_corner),
                away_corner = values(away_corner),
                corner_str = values(corner_str),
                link = values(link)
            """;
    private static final String SQL_CRAWL_DATE = """
              update crawl_date
              set status = :status
              where date = :date
            """;
    private static final String SQL_INSERT_EVENT_UPCOMING = """
            insert ignore into events(detail_link, event_name, event_date, league_name)
                        values (:event_link, :event_name, :event_date, :league_name)
            """;
    private static final String SQL_INSERT_PREDICT = """
            insert ignore into predict(event_link, event_name, event_date, league_name)
                        values (:event_link, :event_name, :event_date, :league_name)
            """;
    private static final String SQL_PREDICT_LEAGUE = """
            update predict ea
                inner join kira_league kl on kl.league_name = ea.league_name
            set ea.league_id = kl.league_id
            where ea.league_id is null
            """;
    private static final String SQL_EVENT_LEAGUE = """
            update events ea
                inner join kira_league kl on kl.league_name = ea.league_name
            set ea.league_id = kl.league_id
            where ea.league_id is null
            """;
    private static final String SQL_INSERT_LEAGUE = """
            insert ignore into kira_league(league_name)
            select distinct league_name
            from events
            order by league_name
            """;
    private final NamedParameterJdbcTemplate jdbcTemplate;

    public void crawlTomorrowEventToPredict(String date) {
        PlaywrightUtil.withPlaywright(Collections.emptyList(), (page, list) -> {
            try {
                log.info("Crawl tomorrow event for date: " + date);
                var result = new ArrayList<EventHtml>();
                page.navigate(Constants.AI_SCORE_URL + "%s".formatted(date));
                page.waitForSelector(MATCH_BOX_SELECTOR, new Page.WaitForSelectorOptions().setTimeout(MAX_WAIT_TIME));
                page.click("span.changeItem:has-text(\"Scheduled\")");
                page.click("span.sortByText:has-text(\"Sort by time\")");
                page.waitForLoadState(LoadState.NETWORKIDLE);
                crawlEvent(result, page, date);
                var params = result.stream()
                        .map(it -> new MapSqlParameterSource()
                                .addValue("event_link", it.getDetailLink())
                                .addValue("event_name", it.getEventName())
                                .addValue("league_name", it.getLeagueName())
                                .addValue("event_date", DateUtil.parseDate(it.getTime())))
                        .toList();
                JdbcBatchUtils.batchInsertSafe(jdbcTemplate, SQL_INSERT_EVENT_UPCOMING, params);
                JdbcBatchUtils.batchInsertSafe(jdbcTemplate, SQL_INSERT_PREDICT, params);
            } catch (Exception ex) {
                log.log(Level.WARNING, "Error during crawlTomorrowEvent", ex);
            } finally {
                jdbcTemplate.update(SQL_INSERT_LEAGUE, Map.of());
                jdbcTemplate.update(SQL_EVENT_LEAGUE, Map.of());
                jdbcTemplate.update(SQL_PREDICT_LEAGUE, Map.of());
                log.info("Crawl tomorrow end event for date: " + date);
            }
        });
    }

    public void crawlByDateToAnalyst(List<String> dates) {
        PlaywrightUtil.withPlaywright(dates, (page, mDates) -> mDates.forEach(date -> {
            var paramsDate = new MapSqlParameterSource("date", date);
            jdbcTemplate.update(SQL_CRAWL_DATE, paramsDate.addValue(STATUS, "in_progress"));
            var result = new ArrayList<EventHtml>();
            try {
                page.navigate(Constants.AI_SCORE_URL + "%s".formatted(date));
                page.waitForSelector(
                        MATCH_BOX_SELECTOR,
                        new Page.WaitForSelectorOptions().setTimeout(MAX_WAIT_TIME)
                );
                page.click("span.changeItem:has-text(\"Finished\")");
                page.click("span.sortByText:has-text(\"Sort by time\")");
                page.waitForTimeout(2_000);
                crawlEvent(result, page, date);
                var params = result.stream()
                        .map(EventHtml::toMap)
                        .toList();
                JdbcBatchUtils.batchInsertSafe(jdbcTemplate, INSERT_SQL_EVENT_ANALYST, params);
                jdbcTemplate.update(SQL_CRAWL_DATE, paramsDate.addValue(STATUS, "completed"));
            } catch (Exception ex) {
                log.log(Level.WARNING, "Error during analystDate", ex);
                jdbcTemplate.update(SQL_CRAWL_DATE, paramsDate.addValue(STATUS, "failed"));
            } finally {
                log.info("Crawl analystDate for date: " + date + " done at " + new Date());
            }
        }));
    }

    private void crawlEvent(List<EventHtml> result, Page page, String date) {
        page.waitForTimeout(5_000);
        int previousHeight = 0;
        int currentHeight;
        int maxTries = 2000;
        int scrollStep = 500;
        int tries = 0;

        while (tries < maxTries) {
            page.waitForTimeout(1_500);
            var pageSource = page.content();
            var doc = Jsoup.parse(pageSource, Constants.AI_SCORE_URL);
            var events = doc.select(".vue-recycle-scroller__item-view")
                    .stream()
                    .map(l -> {
                        var leagueName = "%s %s".formatted(
                                l.select(".country-name").text(),
                                l.select(".compe-name").text()
                        );
                        return l.select("a.match-container")
                                .stream()
                                .map(e -> new EventHtml(e, leagueName, date))
                                .filter(e -> e.getEventDate() != null)
                                .toList();
                    })
                    .flatMap(Collection::stream)
                    .filter(e -> result.stream()
                            .filter(item -> item.getEventName().equalsIgnoreCase(e.getEventName())
                                    &&
                                    item.getLeagueName().equalsIgnoreCase(e.getLeagueName())
                                    &&
                                    item.getTime().equalsIgnoreCase(e.getTime())
                            )
                            .findFirst()
                            .isEmpty())
                    .toList();
            result.addAll(events);
            currentHeight = ((Number) page.evaluate("() => document.body.scrollHeight")).intValue();

            if (currentHeight <= previousHeight) {
                break;
            }
            page.evaluate("window.scrollBy(0, %d)".formatted(scrollStep));
            previousHeight += scrollStep;
            tries++;
        }
    }
}
