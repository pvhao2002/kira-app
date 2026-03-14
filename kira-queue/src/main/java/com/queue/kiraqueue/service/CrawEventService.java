package com.queue.kiraqueue.service;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.WaitUntilState;
import com.queue.kiraqueue.dto.Event;
import com.queue.kiraqueue.dto.model.EventOddsTimeline;
import com.queue.kiraqueue.util.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.logging.Level;

@Log
@Service
@RequiredArgsConstructor(onConstructor_ = @Autowired)
public class CrawEventService {
    private final NamedParameterJdbcTemplate jdbcTemplate;
    private static final long MAX_WAIT_TIME = 60_000;
    private static final long MIN_WAIT_TIME = 2_000;
    private static final String EVENT_ID = "event_id";
    private static final String EVENT_NAME = "event_name";
    private static final String EVENT_DATE = "event_date";
    private static final String STATUS = "status";
    private static final String ODD_ITEM_BOX = ".oddsItemBox";

    private static final String SQL_DELETE_EVENT_UPCOMING = """
            delete from events where event_id = :event_id
            """;
    private static final String SQL_CLEAN_EVENT = """
            delete
            from event_analyst
            where event_name = :event_name
              and event_date = :event_date
            """;

    private static final String SQL_UPDATE_EVENT_ANAYLYST = """
            update event_analyst
            set first_home_odds        = :first_home_odds,
                first_away_odds        = :first_away_odds,
                first_over_corner_odds = :first_over_corner_odds,
                first_under_corner_odds= :first_under_corner_odds,
                first_over_odds        = :first_over_odds,
                first_under_odds       = :first_under_odds,
            
                last_home_odds         = :last_home_odds,
                last_away_odds         = :last_away_odds,
                last_over_corner_odds  = :last_over_corner_odds,
                last_under_corner_odds = :last_under_corner_odds,
                last_over_odds         = :last_over_odds,
                last_under_odds        = :last_under_odds,
            
                first_hdc              = :first_hdc,
                last_hdc               = :last_hdc,
                first_ou               = :first_ou,
                last_ou                = :last_ou,
                first_corner           = :first_corner,
                last_corner            = :last_corner,
            
                home_logo              = :home_logo,
                away_logo              = :away_logo,
                status                 = 'completed'
            where event_id = :event_id
            """;
    private static final String SQL_UPDATE_EVENT_ANALYST = """
            update event_analyst set status = :status where event_id = :event_id
            """;
    private static final String SQL_UPDATE_EVENT_UPCOMING = """
            update events
            set first_home_odds        = :first_home_odds,
                 first_away_odds        = :first_away_odds,
                 last_home_odds         = :last_home_odds,
                 last_away_odds         = :last_away_odds,
                 first_over_corner_odds = :first_over_corner_odds,
                 first_under_corner_odds= :first_under_corner_odds,
                 last_over_corner_odds  = :last_over_corner_odds,
                 last_under_corner_odds = :last_under_corner_odds,
            
                 first_over_odds        = :first_over_odds,
                 first_under_odds       = :first_under_odds,
                 last_over_odds         = :last_over_odds,
                 last_under_odds        = :last_under_odds,
            
                 first_hdc              = :first_hdc,
                 last_hdc               = :last_hdc,
                 first_ou               = :first_ou,
                 last_ou                = :last_ou,
                 first_corner           = :first_corner,
                 last_corner            = :last_corner,
            
                 home_logo              = :home_logo,
                 away_logo              = :away_logo
             where event_id = :event_id
            """;

    private static final String SQL_UPDATE_PREDICT = """
            insert into predict(event_name, event_date, league_name, event_link,
                                  first_hdc_line, first_home_odds, first_away_odds,
                                  last_hdc_line, last_home_odds, last_away_odds,
                                  first_ou_line, first_over_odds, first_under_odds,
                                  last_ou_line, last_over_odds, last_under_odds,
                                  first_corner_line, first_over_corner_odds, first_under_corner_odds,
                                  last_corner_line, last_over_corner_odds, last_under_corner_odds)
              values (:event_name, :event_date, :league_name, :event_link,
                      :first_hdc, :first_home_odds, :first_away_odds,
                      :last_hdc, :last_home_odds, :last_away_odds,
                      :first_ou, :first_over_odds, :first_under_odds,
                      :last_ou, :last_over_odds, :last_under_odds,
                      :first_corner, :first_over_corner_odds, :first_under_corner_odds,
                      :last_corner, :last_over_corner_odds, :last_under_corner_odds)
              on duplicate key update first_hdc_line          = values(first_hdc_line),
                                      first_home_odds         = values(first_home_odds),
                                      first_away_odds         = values(first_away_odds),
            
                                      last_hdc_line           = values(last_hdc_line),
                                      last_home_odds          = values(last_home_odds),
                                      last_away_odds          = values(last_away_odds),
            
                                      first_ou_line           = values(first_ou_line),
                                      first_over_odds         = values(first_over_odds),
                                      first_under_odds        = values(first_under_odds),
            
                                      last_ou_line            = values(last_ou_line),
                                      last_over_odds          = values(last_over_odds),
                                      last_under_odds         = values(last_under_odds),
            
                                      first_corner_line       = values(first_corner_line),
                                      first_over_corner_odds  = values(first_over_corner_odds),
                                      first_under_corner_odds = values(first_under_corner_odds),
            
                                      last_corner_line        = values(last_corner_line),
                                      last_over_corner_odds   = values(last_over_corner_odds),
                                      last_under_corner_odds  = values(last_under_corner_odds)
            """;
    private static final String SQL_PREDICT_NO_ODD = """
            delete p
            from predict p
            where event_date = :event_date
                and event_name = :event_name
            """;
    private static final String DELETE_CRAWL_PREDICT_QUEUE = """
            delete
            from crawl_predict_queue
            where queue_key = :queue_key
              and queue_type = :queue_type
            """;

    private static final String INSERT_EVENT_FAIL = """
            INSERT INTO event_crawl_failed(event_id, message, html)
            VALUES (:event_id, :mess, :html)
            ON DUPLICATE KEY UPDATE message = values(message),
                                    html    = values(html)
            """;

    private static final String SQL_INSERT_EVENT_ODDS = """
            INSERT INTO event_odds(event_id, type, market, line, price_a, price_b)
            VALUES (:event_id, :type, :market, :line, :price_a, :price_b)
            ON DUPLICATE KEY UPDATE line = VALUES(line), price_a = VALUES(price_a), price_b = VALUES(price_b)
            """;

    private static final String SQL_INSERT_EVENT_ODDS_TIMELINE = """
            INSERT INTO event_odds_timeline(event_id, market, line, price_a, price_b, match_minute, crawled_at)
            VALUES (:event_id, :market, :line, :price_a, :price_b, :match_minute, :crawled_at)
            """;

    /**
     * Xóa odds cũ của event để regen không bị trùng / lỗi.
     */
    private static final String SQL_DELETE_EVENT_ODDS = "DELETE FROM event_odds WHERE event_id = :event_id";
    private static final String SQL_DELETE_EVENT_ODDS_TIMELINE = "DELETE FROM event_odds_timeline WHERE event_id = :event_id";

    public void processEvent(Long eventId) {
        var sqlGetEvent = "select event_id , link , event_name from events where event_id = :eid";
        var event = jdbcTemplate.query(sqlGetEvent, Map.of("eid", eventId), BeanPropertyRowMapper.newInstance(Event.class)).stream().findFirst().orElse(null);
        if (event == null) {
            log.log(Level.WARNING, "Event {0} not found", eventId);
            return;
        }
        log.info("Crawl event start: eventId=%d, eventName=%s".formatted(event.getEventId(), event.getEventName()));
        PlaywrightUtil.withPlaywright(event, (page, evt) -> {
            page.navigate(
                    event.getLink().replace(Constants.AI_SCORE_URL, Constants.M_AI_SCORE_URL),
                    new Page.NavigateOptions().setWaitUntil(WaitUntilState.NETWORKIDLE)
            );
            PlaywrightUtil.waitDomContentLoaded(page);
            PlaywrightUtil.removeAcceptAll(page);
            page.waitForSelector("[role=tab]");
            page.locator("[role=tab]").all().forEach(it -> {
                if ("stats".equalsIgnoreCase(it.textContent())) {
                    CompletableFuture.runAsync(() -> {
//                        crawlStatEvents(evt);
                    });
                } else if ("odds".equalsIgnoreCase(it.textContent())) {
                    CompletableFuture.runAsync(() -> {
                        crawlOddEvents(evt);
                    });
                }
            });
        });
    }

    private void crawlStatEvents(Event event) {
        PlaywrightUtil.withPlaywright(event, (page, evt) -> {
            page.navigate(
                    event.getLink().concat("/stats").replace(Constants.AI_SCORE_URL, Constants.M_AI_SCORE_URL),
                    new Page.NavigateOptions().setWaitUntil(WaitUntilState.NETWORKIDLE)
            );
            PlaywrightUtil.waitDomContentLoaded(page);
            PlaywrightUtil.removeAcceptAll(page);
            var menus = page.querySelectorAll(".btnBox > *");
            int count = menus.size();
            if (count < 3) {
                log.warning("Crawl stats skip: eventId=%d, menus=%d (need >= 3)".formatted(event.getEventId(), count));
                var params = new MapSqlParameterSource("event_id", event.getEventId())
                        .addValue("mess", "Not enough menu ht and ft")
                        .addValue("html", page.content());
                jdbcTemplate.update(INSERT_EVENT_FAIL, params);
                return;
            }
            menus.get(1).click();


            menus.get(2).click();
        });
    }

    private void crawlOddEvents(Event event) {
        log.info("Crawl odds start: eventId=%d".formatted(event.getEventId()));
        PlaywrightUtil.withPlaywright(event, (page, evt) -> {
            var listTabOdds = Map.of("asian handicap", "hdc", "total goals", "ou", "total corners", "corner");
            page.navigate(
                    event.getLink().concat("/odds").replace(Constants.AI_SCORE_URL, Constants.M_AI_SCORE_URL),
                    new Page.NavigateOptions().setWaitUntil(WaitUntilState.NETWORKIDLE)
            );
            page.waitForSelector(".oddTypesBox span");
            var tabOdds = page.locator(".oddTypesBox span");
            int count = tabOdds.count();
            log.info("Crawl odds: eventId=%d, tabs=%d".formatted(evt.getEventId(), count));
            deleteOddsForEvent(evt.getEventId());
            final boolean[] isOpenModal = {false};
            for (int i = 0; i < count; i++) {
                if (isOpenModal[0]) {
                    page.locator(".van-popup.van-popup--bottom span i.iconfont.icon-guanbi").click();
                }
                Locator tab = tabOdds.nth(i);
                tab.click();
                String tabNormalize = StringUtil.normalizeText(tab.innerText());
                for (var e : listTabOdds.entrySet()) {
                    if (!e.getKey().equalsIgnoreCase(tabNormalize)) continue;
                    String market = e.getValue();
                    page.waitForSelector(".oddsBoxRight");
                    page.locator(".oddsBox > .oddsBoxRight").first().click();
                    isOpenModal[0] = true;
                    page.waitForSelector("ul.oddContent li");
                    var listLi = page.querySelectorAll("ul.oddContent li");
                    var timelineItems = listLi.stream()
                            .map(li -> new EventOddsTimeline(li, market))
                            .toList();
                    log.info("Crawl odds: eventId=%d, market=%s, timelineItems=%d".formatted(evt.getEventId(), market, timelineItems.size()));
                    persistOddsForMarket(evt.getEventId(), market, timelineItems);
                }
            }
            log.info("Crawl odds done: eventId=%d".formatted(evt.getEventId()));
        });
    }

    /**
     * Xóa toàn bộ odds của event trước khi insert lại — regen an toàn, không lỗi duplicate.
     */
    private void deleteOddsForEvent(Long eventId) {
        int timelineDeleted = jdbcTemplate.update(SQL_DELETE_EVENT_ODDS_TIMELINE, Map.of("event_id", eventId));
        int oddsDeleted = jdbcTemplate.update(SQL_DELETE_EVENT_ODDS, Map.of("event_id", eventId));
        log.info("Delete odds for regen: eventId=%d, event_odds_timeline=%d, event_odds=%d".formatted(eventId, timelineDeleted, oddsDeleted));
    }

    /**
     * open = giá trị odd đầu tiên (dòng đầu timeline).
     * pre-match = giá trị cuối trước khi trận bắt đầu; dòng cuối có ngày giờ.
     * half-time = dòng cuối cùng có match_minute = HT (hiệp 1).
     */
    private void persistOddsForMarket(Long eventId, String market, List<EventOddsTimeline> timelineItems) {
        if (CollectionUtils.isEmpty(timelineItems)) {
            log.warning("persistOddsForMarket skip: eventId=%d, market=%s, empty timeline".formatted(eventId, market));
            return;
        }
        var now = LocalDateTime.now();
        var timelineParams = timelineItems.stream()
                .map(t -> toTimelineParams(eventId, market, t, now))
                .toList();
        JdbcBatchUtils.batchInsertSafe(jdbcTemplate, SQL_INSERT_EVENT_ODDS_TIMELINE, timelineParams);
        log.info("persistOdds: eventId=%d, market=%s, timeline inserted=%d".formatted(eventId, market, timelineParams.size()));

        var firstInList = timelineItems.getFirst();
        var lastInList = timelineItems.getLast();
        jdbcTemplate.update(SQL_INSERT_EVENT_ODDS, toEventOddsParams(eventId, "open", market, lastInList));
        jdbcTemplate.update(SQL_INSERT_EVENT_ODDS, toEventOddsParams(eventId, "pre-match", market, firstInList));

        var firstHtOpt = timelineItems.stream()
                .filter(t -> t.getMatchMinute() != null && t.getMatchMinute().trim().equalsIgnoreCase("ht"))
                .findFirst();
        if (firstHtOpt.isPresent()) {
            jdbcTemplate.update(SQL_INSERT_EVENT_ODDS, toEventOddsParams(eventId, "half-time", market, firstHtOpt.get()));
            log.info("persistOdds: eventId=%d, market=%s, open+pre-match+half-time".formatted(eventId, market));
        } else {
            log.info("persistOdds: eventId=%d, market=%s, open+pre-match (no HT row)".formatted(eventId, market));
        }
    }

    private MapSqlParameterSource toTimelineParams(Long eventId, String market, EventOddsTimeline t, LocalDateTime defaultCrawledAt) {
        LocalDateTime crawledAt = (t.getDate() != null && !t.getDate().isBlank())
                ? DateUtil.parseOddDate(t.getDate(), defaultCrawledAt)
                : defaultCrawledAt;
        return new MapSqlParameterSource()
                .addValue("event_id", eventId)
                .addValue("market", market)
                .addValue("line", t.getLine())
                .addValue("price_a", t.getPriceA())
                .addValue("price_b", t.getPriceB())
                .addValue("match_minute", t.getMatchMinute())
                .addValue("crawled_at", crawledAt);
    }

    private MapSqlParameterSource toEventOddsParams(Long eventId, String type, String market, EventOddsTimeline t) {
        return new MapSqlParameterSource()
                .addValue("event_id", eventId)
                .addValue("type", type)
                .addValue("market", market)
                .addValue("line", t.getLine())
                .addValue("price_a", t.getPriceA())
                .addValue("price_b", t.getPriceB());
    }
}
