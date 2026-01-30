package com.queue.kiraqueue.service;

import com.microsoft.playwright.ElementHandle;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.PlaywrightException;
import com.microsoft.playwright.options.WaitUntilState;
import com.queue.kiraqueue.dto.*;
import com.queue.kiraqueue.util.*;
import io.micrometer.common.util.StringUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.BiConsumer;
import java.util.function.Function;
import java.util.logging.Level;

@Log
@Service
@RequiredArgsConstructor
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

    public void processEvent(Long eventId) {
        var sqlGetEvent = "select event_id , link , event_name from events where event_id = :eid";
        var event = jdbcTemplate.query(sqlGetEvent, Map.of("eid", eventId), BeanPropertyRowMapper.newInstance(Event.class)).stream().findFirst().orElse(null);
        if (event == null) {
            log.log(Level.WARNING, "Event {0} not found", eventId);
            return;
        }
        PlaywrightUtil.withPlaywright(event, (page, evt) -> {
            page.navigate(
                    event.getLink().replace(Constants.AI_SCORE_URL, Constants.M_AI_SCORE_URL),
                    new Page.NavigateOptions().setWaitUntil(WaitUntilState.NETWORKIDLE)
            );
            PlaywrightUtil.waitDomContentLoaded(page);
            PlaywrightUtil.removeAcceptAll(page);
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
        PlaywrightUtil.withPlaywright(event, (page, evt) -> {
            var listTabOdds = List.of("asian handicap", "total goals", "total corners");
            page.navigate(
                    event.getLink().concat("/odds").replace(Constants.AI_SCORE_URL, Constants.M_AI_SCORE_URL),
                    new Page.NavigateOptions().setWaitUntil(WaitUntilState.NETWORKIDLE)
            );
            page.waitForSelector(".oddTypesBox span");
            var tabOdds = page.locator(".oddTypesBox span");
            int count = tabOdds.count();
            boolean isOpenModal = false;
            for (int i = 0; i < count; i++) {
                Locator tab = tabOdds.nth(i);
                String tabNormalize = StringUtil.normalizeText(tab.innerText());

                if (listTabOdds.contains(tabNormalize)) {
                    if (isOpenModal) {
                        page.locator(".van-popup.van-popup--bottom span i.iconfont.icon-guanbi").click();
                        isOpenModal = false;
                    }
                    tab.click();
                    isOpenModal = true;
                    page.waitForSelector(".oddsBoxRight");
                    page.locator(".oddsBox > .oddsBoxRight").first().click();
                    page.querySelectorAll(".oddContent li").forEach(li -> {
                        if (li.querySelectorAll(".firstSpan").size() > 3) {
                        } else {
                            
                        }
                    });
                }

                page.waitForTimeout(1000);
            }
            page.waitForTimeout(5000);
        });
    }
}
