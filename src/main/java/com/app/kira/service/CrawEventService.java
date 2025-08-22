package com.app.kira.service;

import com.app.kira.model.*;
import com.app.kira.model.task.OddsConfig;
import com.app.kira.schedule.EventSchedule;
import com.app.kira.server.ServerInfoService;
import com.app.kira.util.DateUtil;
import com.app.kira.util.JsonUtil;
import com.app.kira.util.PlaywrightUtil;
import com.microsoft.playwright.ElementHandle;
import com.microsoft.playwright.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.apache.commons.lang3.StringUtils;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.BiConsumer;
import java.util.function.Function;
import java.util.logging.Level;

@Log
@Service
@RequiredArgsConstructor
public class CrawEventService {
    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final ServerInfoService serverInfoService;
    private static final String MONEY_LINE_1X2 = "1x2";
    private static final String HDC = "hdc";
    private static final String HANDICAP = "handicap";
    private static final String OU = "ou";
    private static final String CORNER = "corner";
    private static final String EVENT_ID = "event_id";
    private static final String EVENT_NAME = "event_name";
    private static final String EVENT_DATE = "event_date";
    private static final String ODD_VALUE = "odd_value";
    private static final String ODD_TYPE = "odd_type";
    private static final String SQL_INSERT_ODD_ANALYST = """
            INSERT INTO odd_analyst(event_id, odd_type, odd_value)
                 SELECT e.event_id, :odd_type, :odd_value
                 FROM event_analyst e
                 WHERE TRUE
                   AND e.event_name = :event_name
                   AND e.event_date = :event_date
                 ON DUPLICATE KEY UPDATE odd_value = values(odd_value)
            """;

    private static final String SQL_GET_EVENT_UPCOMING = """
            select e.event_id, event_name, event_date, league_name, detail_link
            from events e
            where true
              and event_date >= CONVERT_TZ(NOW(), 'SYSTEM', '+07:00')
              and (
                (event_date < CONVERT_TZ(NOW(), 'SYSTEM', '+07:00') + interval 5 hour)
                    or
                (e.first_hdc is null)
                )
            group by e.event_id
            """;
    private static final String SQL_DELETE_EVENT_UPCOMING = """
            delete from events where event_id = :event_id
            """;
    private static final String SQL_CLEAN_EVENT = """
            delete
            from event_analyst
            where event_name = :event_name
              and event_date = :event_date
            """;

    private static final String SQL_UPDATE_EVENT_UPCOMING = """
            update events
            set first_home_odds  = :first_home_odds,
                first_away_odds  = :first_away_odds,
                last_home_odds   = :last_home_odds,
                last_away_odds   = :last_away_odds,
            
                first_over_odds  = :first_over_odds,
                first_under_odds = :first_under_odds,
                last_over_odds   = :last_over_odds,
                last_under_odds  = :last_under_odds,
            
                first_hdc        = :first_hdc,
                last_hdc         = :last_hdc,
                first_ou         = :first_ou,
                last_ou          = :last_ou,
            
                home_logo        = :home_logo,
                away_logo        = :away_logo
            where event_id = :eventId
            """;

    private static final String SQL_UPDATE_PREDICT = """
            insert into predict(event_name, event_date, league_name, event_link,
                                first_hdc_line, first_home_odds, first_away_odds,
                                last_hdc_line, last_home_odds, last_away_odds,
                                first_ou_line, first_over_odds, first_under_odds,
                                last_ou_line, last_over_odds, last_under_odds)
            values (:event_name, :event_date, :league_name, :event_link,
                    :first_hdc_line, :first_home_odds, :first_away_odds,
                    :last_hdc_line, :last_home_odds, :last_away_odds,
                    :first_ou_line, :first_over_odds, :first_under_odds,
                    :last_ou_line, :last_over_odds, :last_under_odds)
            on duplicate key update first_hdc_line   = values(first_hdc_line),
                                    first_home_odds  = values(first_home_odds),
                                    first_away_odds  = values(first_away_odds),
            
                                    last_hdc_line    = values(last_hdc_line),
                                    last_home_odds   = values(last_home_odds),
                                    last_away_odds   = values(last_away_odds),
            
                                    first_ou_line    = values(first_ou_line),
                                    first_over_odds  = values(first_over_odds),
                                    first_under_odds = values(first_under_odds),
            
                                    last_ou_line     = values(last_ou_line),
                                    last_over_odds   = values(last_over_odds),
                                    last_under_odds  = values(last_under_odds)
            """;

    public void processOddForUpcomingEvent() {
        log.log(Level.INFO, "Crawl Odd For Upcoming Event Start");
        var events = jdbcTemplate.query(SQL_GET_EVENT_UPCOMING, (rs, i) -> new Event(rs));
        if (CollectionUtils.isEmpty(events)) {
            return;
        }

        PlaywrightUtil.withPlaywright(events, EventSchedule.CRAWL_ODD_FOR_UPCOMING_EVENT_METHOD, (page, list) -> list.forEach(event -> {
            try {
                page.navigate(event.getDetailLink());
                page.waitForTimeout(3_000);
                // find tag have class icon-404
                var error404 = page.querySelector(".icon-404");
                if (error404 != null) {
                    log.log(Level.WARNING, "Crawl Event {0}-{1}-{2} Not Found", new Object[]{event.getEventId(), event.getEventName(), event.getDetailLink()});
                    jdbcTemplate.update(SQL_DELETE_EVENT_UPCOMING, new MapSqlParameterSource(EVENT_ID, event.getEventId()));
                    var sqlDelPredictNoOdd = """
                            delete p
                            from predict p
                            where event_date = :event_date
                                and event_name = :event_name
                            """;
                    jdbcTemplate.update(sqlDelPredictNoOdd, new MapSqlParameterSource(EVENT_DATE, event.getEventDate())
                            .addValue(EVENT_NAME, event.getEventName()));
                    return;
                }

                page.waitForSelector(".lookBox", new Page.WaitForSelectorOptions().setTimeout(30_000));
                page.waitForTimeout(2000);
                var tabs = page.querySelectorAll(".content-box .child");
                if (!tabs.isEmpty()) {
                    var checkHaveTabOdd = tabs.stream()
                            .anyMatch(it -> it.textContent().trim().toLowerCase().contains("odds"));
                    if (!checkHaveTabOdd) {
                        jdbcTemplate.update(SQL_DELETE_EVENT_UPCOMING, new MapSqlParameterSource(EVENT_ID, event.getEventId()));
                        log.log(Level.INFO, "processOddForUpcomingEvent - Event {0} not have odd tab", event.getEventId());
                        var sqlDelPredictNoOdd = """
                            delete p
                            from predict p
                            where event_date = :event_date
                                and event_name = :event_name
                            """;
                        jdbcTemplate.update(sqlDelPredictNoOdd, new MapSqlParameterSource(EVENT_DATE, event.getEventDate())
                                .addValue(EVENT_NAME, event.getEventName()));
                        return;
                    }
                    var noData = page.locator("div.color-999.fs-12.mt-12",
                            new Page.LocatorOptions().setHasText("No data"));
                    if (noData.count() > 0 && noData.isVisible()) {
                        log.log(Level.INFO, "processOddForUpcomingEvent - Event {0} - {1} No data", new Object[]{event.getEventName(), event.getDetailLink()});
                        jdbcTemplate.update(SQL_DELETE_EVENT_UPCOMING, new MapSqlParameterSource(EVENT_ID, event.getEventId()));
                        var sqlDelPredictNoOdd = """
                            delete p
                            from predict p
                            where event_date = :event_date
                                and event_name = :event_name
                            """;
                        jdbcTemplate.update(sqlDelPredictNoOdd, new MapSqlParameterSource(EVENT_DATE, event.getEventDate())
                                .addValue(EVENT_NAME, event.getEventName()));
                        return;
                    }
                }

                var lookBoxes = page.querySelectorAll(".lookBox.brb");
                if (!lookBoxes.isEmpty()) {
                    var bet = getOdd(page, lookBoxes);
                    var doc = Jsoup.parse(page.content());
                    var logoElement = doc.select("[itemprop=logo]");

                    var paramUpdate = bet.toPram(event.getEventId());
                    var paramPredict = bet.toParamPredict(event);
                    AtomicReference<String> homeLogo = new AtomicReference<>();
                    AtomicReference<String> awayLogo = new AtomicReference<>();
                    Optional.ofNullable(logoElement.getFirst())
                            .map(it -> it.absUrl("src"))
                            .ifPresent(src -> {
                                homeLogo.set(src);
                                awayLogo.set(src); // Default to home logo if away logo is not found
                            });
                    // Default to home logo if away logo is not found
                    Optional.ofNullable(logoElement.get(1))
                            .map(it -> it.absUrl("src"))
                            .ifPresent(awayLogo::set);
                    paramUpdate.addValue("home_logo", homeLogo.get())
                            .addValue("away_logo", awayLogo.get());
                    jdbcTemplate.update(SQL_UPDATE_EVENT_UPCOMING, paramUpdate);
                    jdbcTemplate.update(SQL_UPDATE_PREDICT, paramPredict);
                } else {
                    log.log(Level.INFO, "processOddForUpcomingEvent - Event {0} empty provider odd", event.getEventId());
                    jdbcTemplate.update(SQL_DELETE_EVENT_UPCOMING, new MapSqlParameterSource(EVENT_ID, event.getEventId()));
                    var sqlDelPredictNoOdd = """
                            delete p
                            from predict p
                            where event_date = :event_date
                                and event_name = :event_name
                            """;
                    jdbcTemplate.update(sqlDelPredictNoOdd, new MapSqlParameterSource(EVENT_DATE, event.getEventDate())
                            .addValue(EVENT_NAME, event.getEventName()));
                }
                page.waitForTimeout(5_000);
            } catch (Exception ex) {
                log.log(Level.SEVERE, "crawlOddForUpcomingEvent >> Crawl Event %s-%s-%s Failed".formatted(event.getEventId(), event.getEventName(), event.getDetailLink()), ex);
            }
        }));

        log.log(Level.INFO, "Crawl Odd For Upcoming Event End");
    }

    private Bet getOdd(Page page, List<ElementHandle> lookBoxes) {
        var bet = Bet.builder();
        lookBoxes.getFirst().click();
        var oddButton = page.querySelectorAll(".changeItem");
        if (oddButton.size() >= 4) {
            var oddsConfigMap = getOddsConfigMap();
            var betSetterMap = getBetSetterMap();

            for (int idx = 1; idx <= 4; idx++) {
                OddsConfig<BaseOdd> config = oddsConfigMap.get(idx);
                if (config == null) continue;
                List<?> odds = clickAndParseOdds(page, oddButton, idx, config);
                BiConsumer<Bet.BetBuilder, List<?>> setter = betSetterMap.get(idx);
                if (setter != null) setter.accept(bet, odds);
            }
        }
        var resultBet = bet.build();
        resultBet.cleanOdd();
        return resultBet;
    }

    public void processCrawEvent() {
        var sqlEvents = """
                select id,
                       event_name,
                       event_date as time,
                       detail_link
                from event_crawl
                where status = 'pending' or status = 'failed'
                LIMIT 50
                """;
        var events = jdbcTemplate.query(sqlEvents, BeanPropertyRowMapper.newInstance(EventHtml.class));
        if (events.isEmpty()) {
            return;
        }
        PlaywrightUtil.withPlaywright(events, EventSchedule.EVENT_METHOD, (page, list) -> list.forEach(event -> {
            List<MapSqlParameterSource> result = new ArrayList<>();
            var baseParam = new MapSqlParameterSource(EVENT_ID, event.getId());
            var paramWithHost = baseParam.addValue("os", serverInfoService.getHostName());
            try {
                jdbcTemplate.update("update event_crawl set status = 'in_progress' where id = :event_id", baseParam);
                log.log(Level.INFO, "Crawl Event {0}-{1}-{2} Start", new Object[]{event.getId(), event.getEventName(), event.getDetailLink()});
                page.navigate(event.getDetailLink() + "/odds");
                page.waitForTimeout(3000);
                // find tag have class icon-404
                var error404 = page.querySelector(".icon-404");
                if (error404 != null) {
                    log.log(Level.WARNING, "Crawl Event {0}-{1}-{2} Not Found", new Object[]{event.getId(), event.getEventName(), event.getDetailLink()});
                    jdbcTemplate.update("""
                            insert into pc(pc_name, event_id, status, message) VALUES (:os, :event_id, 'fail', '401 GONE')
                            """, paramWithHost);
                    jdbcTemplate.update(SQL_CLEAN_EVENT, new MapSqlParameterSource()
                            .addValue(EVENT_NAME, event.getEventName())
                            .addValue(EVENT_DATE, event.getTime()));
                    return;
                }

                page.waitForSelector(".lookBox", new Page.WaitForSelectorOptions().setTimeout(30_000));
                page.waitForTimeout(2000);

                var tabs = page.querySelectorAll(".content-box .child");
                if (!tabs.isEmpty()) {
                    var checkHaveTabOdd = tabs.stream()
                            .anyMatch(it -> it.textContent().trim().toLowerCase().contains("odds"));
                    if (!checkHaveTabOdd) {
                        log.log(Level.INFO, "Crawl Odd For Event End - Event {0} - {1} not have odd tab", new Object[]{event.getEventName(), event.getDetailLink()});
                        jdbcTemplate.update("""
                                insert into pc(pc_name, event_id, status, message) VALUES (:os, :event_id, 'fail', 'NO TAB ODD')
                                """, paramWithHost);
                        jdbcTemplate.update(SQL_CLEAN_EVENT, new MapSqlParameterSource()
                                .addValue(EVENT_NAME, event.getEventName())
                                .addValue(EVENT_DATE, event.getTime()));
                        return;
                    }
                    var noData = page.locator("div.color-999.fs-12.mt-12",
                            new Page.LocatorOptions().setHasText("No data"));
                    if (noData.count() > 0 && noData.isVisible()) {
                        log.log(Level.INFO, "Crawl Odd For Event End - Event {0} - {1} No data", new Object[]{event.getEventName(), event.getDetailLink()});
                        jdbcTemplate.update("""
                                insert into pc(pc_name, event_id, status, message) VALUES (:os, :event_id, 'fail', 'NO DATA')
                                """, paramWithHost);
                        jdbcTemplate.update(SQL_CLEAN_EVENT, new MapSqlParameterSource()
                                .addValue(EVENT_NAME, event.getEventName())
                                .addValue(EVENT_DATE, event.getTime()));
                        return;
                    }
                }
                var lookBoxes = page.querySelectorAll(".lookBox.brb");
                if (!lookBoxes.isEmpty()) {
                    var resultBet = getOdd(page, lookBoxes);
                    result.add(new MapSqlParameterSource()
                            .addValue(EVENT_NAME, event.getEventName())
                            .addValue(EVENT_DATE, event.getTime())
                            .addValue(ODD_VALUE, JsonUtil.toJson(resultBet.getOdds1x2()))
                            .addValue(ODD_TYPE, MONEY_LINE_1X2));

                    result.add(new MapSqlParameterSource()
                            .addValue(EVENT_NAME, event.getEventName())
                            .addValue(EVENT_DATE, event.getTime())
                            .addValue(ODD_VALUE, JsonUtil.toJson(resultBet.getOddsHandicap()))
                            .addValue(ODD_TYPE, HDC));

                    result.add(new MapSqlParameterSource()
                            .addValue(EVENT_NAME, event.getEventName())
                            .addValue(EVENT_DATE, event.getTime())
                            .addValue(ODD_VALUE, JsonUtil.toJson(resultBet.getOddsGoal()))
                            .addValue(ODD_TYPE, OU));

                    result.add(new MapSqlParameterSource()
                            .addValue(EVENT_NAME, event.getEventName())
                            .addValue(EVENT_DATE, event.getTime())
                            .addValue(ODD_VALUE, JsonUtil.toJson(resultBet.getOddsCorner()))
                            .addValue(ODD_TYPE, CORNER));
                    jdbcTemplate.batchUpdate(SQL_INSERT_ODD_ANALYST, result.toArray(new MapSqlParameterSource[0]));
                    jdbcTemplate.update("""
                              insert into pc(pc_name, event_id, status) VALUES (:os, :event_id, 'ok')
                            """, paramWithHost);
                } else {
                    jdbcTemplate.update("""
                              insert into pc(pc_name, event_id, status, message) VALUES (:os, :event_id, 'ok', 'NOT_FOUND_ODD')
                            """, paramWithHost);
                    log.log(Level.INFO, "Crawl Odd For Event End - Event {0} empty provider odd", event.getEventName());
                    jdbcTemplate.update(SQL_CLEAN_EVENT, new MapSqlParameterSource()
                            .addValue(EVENT_NAME, event.getEventName())
                            .addValue(EVENT_DATE, event.getTime()));
                }
            } catch (Exception ex) {
                log.log(Level.SEVERE, "Crawl Event %s-%s-%s Failed".formatted(event.getId(), event.getEventName(), event.getDetailLink()), ex);
                jdbcTemplate.update(
                        "update event_crawl set status = 'failed' where id = :event_id",
                        baseParam
                );
                jdbcTemplate.update("""
                        insert into pc(pc_name, event_id, status, message) VALUES (:os, :event_id, 'fail', :message)
                        """, paramWithHost.addValue("message", ex.getMessage()));
            } finally {
                var sqlDel = "DELETE FROM event_crawl  WHERE id=:event_id AND status <> 'failed'";
                jdbcTemplate.update(sqlDel, baseParam);
                log.log(Level.INFO, "Crawl Event {0}-{1}-{2} End", new Object[]{event.getId(), event.getEventName(), event.getDetailLink()});
            }
        }));
    }

    private <T extends BaseOdd> List<T> parseOdds(Document doc, Function<List<Element>, T> rowMapper) {
        return doc.select("table.el-table__body")
                .select("tr.el-table__row")
                .stream()
                .map(r -> rowMapper.apply(r.select("td")))
                .filter(Objects::nonNull)
                .filter(it -> StringUtils.isNotBlank(it.getOddDate()))
                .filter(it -> !it.getOddDate().contains("'") && !it.getOddDate().contains("HT"))
                .filter(it -> DateUtil.parseOddDate(it.getOddDate(), null) != null)
                .sorted(Comparator.comparing((T o) -> DateUtil.parseOddDate(o.getOddDate())).reversed())
                .toList();
    }

    private <T extends BaseOdd> List<T> clickAndParseOdds(Page page, List<ElementHandle> oddButtons, int btnIndex, OddsConfig<T> config) {
        if (oddButtons.size() < btnIndex) return Collections.emptyList();
        if (btnIndex > 0) {
            oddButtons.get(btnIndex - 1).click();
        }
        page.waitForTimeout(2000);
        Document doc = Jsoup.parse(page.content());
        return parseOdds(doc, config.rowMapper());
    }

    private Map<Integer, OddsConfig<BaseOdd>> getOddsConfigMap() {
        Map<Integer, OddsConfig<BaseOdd>> oddsConfigMap = new HashMap<>();

        oddsConfigMap.put(1, new OddsConfig<>("1x2", tds -> new Odd1x2(
                tds.getFirst().text(),
                tds.get(1).text(),
                tds.get(2).text(),
                tds.getLast().text()
        )));
        oddsConfigMap.put(2, new OddsConfig<>("Handicap", tds -> new OddHandicap(
                tds.getFirst().text(),
                tds.get(1).text(),
                tds.getLast().text()
        )));
        oddsConfigMap.put(3, new OddsConfig<>("Over/Under", tds -> new OddGoal(
                tds.getFirst().text(),
                tds.get(1).text(),
                tds.get(2).text(),
                tds.getLast().text()
        )));
        oddsConfigMap.put(4, new OddsConfig<>("Corner", tds -> new OddCorner(
                tds.getFirst().text(),
                tds.get(1).text(),
                tds.get(2).text(),
                tds.getLast().text()
        )));
        return oddsConfigMap;
    }

    private Map<Integer, BiConsumer<Bet.BetBuilder, List<?>>> getBetSetterMap() {
        Map<Integer, BiConsumer<Bet.BetBuilder, List<?>>> betSetterMap = new HashMap<>();
        betSetterMap.put(1, (builder, odds) -> builder.odds1x2((castList(odds))));
        betSetterMap.put(2, (builder, odds) -> builder.oddsHandicap((castList(odds))));
        betSetterMap.put(3, (builder, odds) -> builder.oddsGoal((castList(odds))));
        betSetterMap.put(4, (builder, odds) -> builder.oddsCorner((castList(odds))));
        return betSetterMap;
    }

    @SuppressWarnings("unchecked")
    private <T> List<T> castList(List<?> list) {
        return (List<T>) list;
    }
}
