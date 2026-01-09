package com.queue.kiraqueue.service;

import com.microsoft.playwright.ElementHandle;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.PlaywrightException;
import com.queue.kiraqueue.dto.*;
import com.queue.kiraqueue.util.Constants;
import com.queue.kiraqueue.util.DateUtil;
import com.queue.kiraqueue.util.OddConverter;
import com.queue.kiraqueue.util.PlaywrightUtil;
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

    public void processEvent(Long eventId) {
        var sqlGetEvent = "select event_id , link , event_name from events where event_id = :eid";
        var event = jdbcTemplate.query(sqlGetEvent, Map.of("eid", eventId), BeanPropertyRowMapper.newInstance(Event.class)).stream().findFirst().orElse(null);
        if (event == null) {
            log.log(Level.WARNING, "Event {0} not found", eventId);
            return;
        }
        PlaywrightUtil.withPlaywrightPages(3, (pages, evt) -> {
            var futures = pages.stream()
                    .map(page -> CompletableFuture.runAsync(() -> {
                        page.navigate(evt.getLink());
                    }))
                    .toList();

            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
        }, event);
    }

    public void processOddForUpcomingEvent(List<Event> events) {
        PlaywrightUtil.withPlaywright(events, (page, evts) -> evts.forEach(event -> {
            long start = System.currentTimeMillis();
            try {
                log.log(Level.INFO, "Crawl Odd For Upcoming Event Start: " + event.getEventId() + " : " + event.getDetailLink());
                page.navigate(event.getDetailLink());
                if (shouldRemoveEvent(page)) {
                    log.log(Level.INFO, "processOddForUpcomingEvent - Event {0} empty provider odd", event.getEventId());
                    removeEvent(event);
                    return;
                }
                var lookBoxes = page.querySelectorAll(".lookBox.brb");
                var bet = getOdd(page, lookBoxes);
                var paramUpdate = bet.toPram(event.getEventId());
                var paramPredict = bet.toParamPredict(event);
                var doc = Jsoup.parse(page.content());
                var logoElement = doc.select("[itemprop=logo]");
                AtomicReference<String> homeLogo = new AtomicReference<>();
                AtomicReference<String> awayLogo = new AtomicReference<>();
                Optional.of(logoElement.getFirst())
                        .map(it -> it.absUrl("src"))
                        .ifPresent(src -> {
                            homeLogo.set(src);
                            awayLogo.set(src); // Default to home logo if away logo is not found
                        });
                Optional.of(logoElement.get(1))
                        .map(it -> it.absUrl("src"))
                        .ifPresent(awayLogo::set);
                paramUpdate.addValue("home_logo", homeLogo.get())
                        .addValue("away_logo", awayLogo.get());
                jdbcTemplate.update(SQL_UPDATE_EVENT_UPCOMING, paramUpdate);
                jdbcTemplate.update(SQL_UPDATE_PREDICT, paramPredict);
            } catch (Exception ex) {
                log.log(Level.SEVERE, "crawlOddForUpcomingEvent >> Crawl Event %s-%s-%s Failed".formatted(event.getEventId(), event.getEventName(), event.getDetailLink()), ex);
            } finally {
                log.log(Level.INFO, "Crawl Odd For Upcoming Event End: " + event.getEventId() + " : " + event.getDetailLink() + " took " + (System.currentTimeMillis() - start) / 1000 + " seconds");
                jdbcTemplate.update(DELETE_CRAWL_PREDICT_QUEUE, Map.of("queue_key", event.getEventId(), "queue_type", Constants.CRAWL_UPCOMING_EVENT));
            }
        }));
    }

    public void processCrawEvent(List<RawEventAnalyst> evts) {
        PlaywrightUtil.withPlaywright(evts, (page, events) -> events.forEach(event -> {
            long start = System.currentTimeMillis();
            try {
                log.log(Level.INFO, "Crawl Event {0}-{1}-{2} Start", new Object[]{event.getEventId(), event.getEventName(), event.getLink()});
                jdbcTemplate.update(SQL_UPDATE_EVENT_ANALYST, Map.of(EVENT_ID, event.getEventId(), STATUS, "in_progress"));
                page.navigate(event.getLink() + "/odds");
                if (shouldRemoveEvent(page)) {
                    log.log(Level.WARNING, "Crawl Event {0}-{1}-{2} Not Found", new Object[]{event.getEventId(), event.getEventName(), event.getLink()});
                    removeEvent(event);
                    return;
                }
                var lookBoxes = page.querySelectorAll(".lookBox.brb");
                var param = getInfo(page);
                if (param == null
                        || param.getValue("first_home_odds") == null
                        || param.getValue("last_home_odds") == null
                        || param.getValue("first_over_odds") == null
                        || param.getValue("last_over_odds") == null
                ) {
                    var bet = getOdd(page, lookBoxes);
                    param = bet.toPram(event.getEventId());
                    var doc = Jsoup.parse(page.content());
                    var logoElement = doc.select("[itemprop=logo]");
                    AtomicReference<String> homeLogo = new AtomicReference<>();
                    AtomicReference<String> awayLogo = new AtomicReference<>();
                    Optional.of(logoElement.getFirst())
                            .map(it -> it.absUrl("src"))
                            .ifPresent(src -> {
                                homeLogo.set(src);
                                awayLogo.set(src); // Default to home logo if away logo is not found
                            });
                    Optional.of(logoElement.get(1))
                            .map(it -> it.absUrl("src"))
                            .ifPresent(awayLogo::set);
                    param.addValue("home_logo", homeLogo.get())
                            .addValue("away_logo", awayLogo.get());
                    param.addValue(EVENT_ID, event.getEventId());
                } else {
                    param.addValue(EVENT_ID, event.getEventId());
                }

                jdbcTemplate.update(SQL_UPDATE_EVENT_ANAYLYST, param);
            } catch (Exception ex) {
                log.log(Level.SEVERE, "Crawl Event %s-%s-%s Failed".formatted(event.getEventId(), event.getEventName(), event.getLink()), ex);
                jdbcTemplate.update(SQL_UPDATE_EVENT_ANALYST, Map.of(EVENT_ID, event.getEventId(), STATUS, "failed"));
            } finally {
                long end = System.currentTimeMillis();
                long sec = (end - start) / 1000;
                log.log(Level.INFO,
                        "Crawl Event {0}-{1}-{2} took {3} seconds",
                        new Object[]{event.getEventId(), event.getEventName(), event.getLink(), sec}
                );
            }
        }));
    }

    private boolean shouldRemoveEvent(Page page) {
        var notFound = page.locator(".icon-404");
        if (notFound.count() > 0 && notFound.isVisible()) {
            return true;
        }
        Locator tabs = page.locator(".content-box .child");
        if (tabs.count() > 0) {
            boolean hasOddTab = tabs.allTextContents().stream()
                    .anyMatch(t -> t.trim().toLowerCase().contains("odds"));
            if (!hasOddTab) {
                return true;
            }

            Locator noData = page.locator("div.color-999.fs-12.mt-12",
                    new Page.LocatorOptions().setHasText("No data"));
            if (noData.count() > 0 && noData.isVisible()) {
                return true;
            }
        }
        var newOdds = page.locator(".newOdds");
        try {
            newOdds.waitFor(new Locator.WaitForOptions().setTimeout(MAX_WAIT_TIME));
        } catch (PlaywrightException e) {
            return true;
        }

        Locator lookBoxes = page.locator(".lookBox.brb");
        return lookBoxes.count() == 0;
    }

    private void processOverUnder(
            Elements ouItems,
            String lineKey,
            String overKey,
            String underKey,
            MapSqlParameterSource param
    ) {
        var oddItems = ouItems.select(".oddItems");
        if (oddItems.size() < 3) {
            param.addValue(lineKey, "");
            param.addValue(overKey, "");
            param.addValue(underKey, "");
            return;
        }
        param.addValue(lineKey, oddItems.getFirst().text());
        var overValue = OddConverter.parse(oddItems.get(1).text());
        var underValue = OddConverter.parse(oddItems.get(2).text());
        Map<String, Object> map = new HashMap<>();
        map.put(overKey, overValue);
        map.put(underKey, underValue);
        param.addValues(map);
    }

    private void processHandicap(Elements handicapItems,
                                 String lineKey,
                                 String homeKey,
                                 String awayKey,
                                 MapSqlParameterSource param
    ) {
        var line = new StringBuilder();
        var odds = new ArrayList<String>();

        handicapItems.forEach(item -> {
            var l = item.select(".handicap.handicapAsia.asiaItemLeft").text().trim();
            line.append(l);
            if (line.indexOf("#") == -1) {
                line.append("#");
            }
            odds.add(item.select(".asiaItemRight").text().trim());
        });

        param.addValue(lineKey, line.toString());
        Map<String, Object> map = new HashMap<>();
        if (odds.size() < 2) {
            map.put(homeKey, null);
            map.put(awayKey, null);
        } else {
            map.put(homeKey, OddConverter.parse(odds.getFirst()));
            map.put(awayKey, OddConverter.parse(odds.getLast()));
        }
        param.addValues(map);
    }

    private MapSqlParameterSource getInfo(Page page) {
        var param = new MapSqlParameterSource();
        page.waitForSelector(".content-box .content", new Page.WaitForSelectorOptions().setTimeout(MAX_WAIT_TIME));
        var content = page.querySelectorAll(".content-box .content").getLast();
        var doc = Jsoup.parse(content.innerHTML());
        var listOddDiv = doc.getElementsByTag("div").getFirst().select(".flex.flex-1.align-center.flex-col");
        listOddDiv.removeFirst();
        if (CollectionUtils.isEmpty(listOddDiv) || listOddDiv.size() < 3) {
            return null;
        }

        // Handle handicap
        var handicapDiv = listOddDiv.getFirst();
        processHandicap(
                handicapDiv.children().getFirst().select(".asiaItemBox"),
                "first_hdc",
                "first_home_odds",
                "first_away_odds",
                param);
        processHandicap(
                handicapDiv.children().get(1).select(".asiaItemBox"),
                "last_hdc",
                "last_home_odds",
                "last_away_odds", param);

        // Handle open ou
        var ouDiv = listOddDiv.get(1);
        processOverUnder(
                ouDiv.children().getFirst().select(ODD_ITEM_BOX),
                "first_ou",
                "first_over_odds",
                "first_under_odds",
                param);
        processOverUnder(
                ouDiv.children().get(1).select(ODD_ITEM_BOX),
                "last_ou",
                "last_over_odds",
                "last_under_odds",
                param);

        var cornerDiv = listOddDiv.get(2);
        processOverUnder(
                cornerDiv.children().getFirst().select(ODD_ITEM_BOX),
                "first_corner",
                "first_over_corner_odds",
                "first_under_corner_odds",
                param);
        processOverUnder(
                cornerDiv.children().get(1).select(ODD_ITEM_BOX),
                "last_corner",
                "last_over_corner_odds",
                "last_under_corner_odds",
                param);

        var docLogo = Jsoup.parse(page.content());
        var logoElement = docLogo.select("[itemprop=logo]");
        var homeSrc = logoElement.getFirst().absUrl("src");
        var awaySrc = logoElement.get(1).absUrl("src");
        param.addValue("home_logo", homeSrc)
                .addValue("away_logo", awaySrc);
        return param;
    }

    private void removeEvent(RawEventAnalyst event) {
        jdbcTemplate.update(SQL_CLEAN_EVENT, new MapSqlParameterSource()
                .addValue(EVENT_NAME, event.getEventName())
                .addValue(EVENT_DATE, event.getEventDate()));
    }

    private void removeEvent(Event evt) {
        jdbcTemplate.update(SQL_DELETE_EVENT_UPCOMING, new MapSqlParameterSource(EVENT_ID, evt.getEventId()));
        jdbcTemplate.update(SQL_PREDICT_NO_ODD, new MapSqlParameterSource(EVENT_DATE, evt.getEventDate())
                .addValue(EVENT_NAME, evt.getEventName()));
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

    private <T extends BaseOdd> List<T> clickAndParseOdds(
            Page page, List<ElementHandle> oddButtons, int btnIndex, OddsConfig<T> config) {
        if (oddButtons.size() < btnIndex) return Collections.emptyList();

        if (btnIndex > 0) {
            page.waitForTimeout(250);
            oddButtons.get(btnIndex - 1).click();
            page.waitForTimeout(500);
        }

        // 3️⃣ Lấy HTML đã render
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
