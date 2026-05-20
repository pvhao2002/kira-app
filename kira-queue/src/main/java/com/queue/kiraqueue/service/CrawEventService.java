package com.queue.kiraqueue.service;

import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.ScreenshotType;
import com.queue.kiraqueue.dto.Event;
import com.queue.kiraqueue.dto.model.EventOddsTimeline;
import com.queue.kiraqueue.util.*;
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

import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.logging.Level;
import java.util.regex.Pattern;

@Log
@Service
@RequiredArgsConstructor
public class CrawEventService {
    private static final String PREFIX_LOG = "CrawEventService >> %s >> %s";
    private static final int EVENT_DATA_ISSUE_DESCRIPTION_MAX_LENGTH = 16_000;
    private final NamedParameterJdbcTemplate jdbcTemplate;
    /**
     * Wall-clock cap for parallel stats+odds crawls (each opens its own browser). Avoids indefinite {@link CompletableFuture#join()}.
     */
    private static final long PARALLEL_CRAWL_TIMEOUT_MINUTES = 10;

    private static final String SQL_UPSERT_EVENT_DATA_ISSUE = """
            INSERT INTO event_data_issue (event_id, issue_type, description, recorded_at)
            VALUES (:eventId, :issueType, :description, :recordedAt)
            ON DUPLICATE KEY UPDATE description = VALUES(description),
                                    recorded_at = VALUES(recorded_at)
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

    /**
     * Cập nhật stats vào event_result (chỉ cột gốc; *_total_* là generated column, không set).
     */
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

    private static final Pattern FIRST_INT = Pattern.compile("(\\d+)");
    private static final String SQL_DELETE_CRAWL_FAIL_SUCCESS = """
            delete from event_crawl_failed
            where event_id = :event_id
              and type in ('main', 'stats', 'odds')
            """;

    /**
     * Matches {@code kira-producer} {@code EventSchedule} claims on queued odd jobs.
     */
    private static final String EVENT_CLAIM_BY_PRODUCER = "kira-producer";

    private static final String SQL_DELETE_EVENT_CLAIM_PRODUCER = """
            delete from event_claim
            where event_id = :event_id
              and claimed_by = :claimed_by
            """;

    private String withPrefix(String context, String message) {
        return PREFIX_LOG.formatted(context, message);
    }

    private String captureScreenshotBase64(Page page) {
        if (page == null || page.isClosed()) {
            return null;
        }
        try {
            byte[] screenshot = page.screenshot(new Page.ScreenshotOptions()
                    .setFullPage(true)
                    .setType(ScreenshotType.JPEG)
                    .setQuality(70));
            return Base64.getEncoder().encodeToString(screenshot);
        } catch (Exception e) {
            log.log(Level.WARNING, withPrefix("captureScreenshotBase64", "Failed to capture screenshot"), e);
            return null;
        }
    }

    private String safeLocatorHtml(com.microsoft.playwright.Locator locator, String selector) {
        int count = locator.count();
        if (count == 0) {
            return "no element matched selector: %s".formatted(selector);
        }
        var firstHtml = locator.first().innerHTML();
        if (count == 1) {
            return firstHtml;
        }
        return "matched %d elements for selector [%s], first element html: %s".formatted(count, selector, firstHtml);
    }

    private String safeLocatorHtml(com.microsoft.playwright.Locator locator) {
        return safeLocatorHtml(locator, "<dynamic-locator>");
    }

    private boolean clickFirstVisible(com.microsoft.playwright.Locator locator) {
        int count = locator.count();
        for (int i = 0; i < count; i++) {
            var candidate = locator.nth(i);
            try {
                if (candidate.isVisible()) {
                    candidate.click();
                    return true;
                }
            } catch (Exception ignored) {
                // DOM can update during crawl; continue with next candidate.
            }
        }
        return false;
    }

    public void processEvent(Long eventId) {
        var sqlGetEvent = "select event_id, link, event_name, status from events where event_id = :eid";
        var event = jdbcTemplate.query(sqlGetEvent, Map.of("eid", eventId), BeanPropertyRowMapper.newInstance(Event.class))
                .stream()
                .findFirst()
                .orElse(null);
        if (event == null) {
            log.log(Level.WARNING, withPrefix("processEvent", "Event {0} not found"), eventId);
            return;
        }
        PlaywrightUtil.withPlaywright(event, (page, evt) -> {
            long start = System.currentTimeMillis();
            try {
                var logStartMsg = "Crawl event start: eventId=%d, eventName=%s, status=%s".formatted(evt.getEventId(), evt.getEventName(), evt.getStatus());
                log.info(withPrefix("processEvent.withPlaywright", logStartMsg));
                openMatchPage(page, evt);
                page.waitForTimeout(400); // wait for page load before next action
                boolean crawlOk = "FT".equals(evt.getStatus())
                        ? processFullTimeEvent(page, evt)
                        : processNonFullTimeEvent(page, evt);
                if (crawlOk) {
                    markEventCrawlSuccess(evt.getEventId());
                }
            } catch (Exception e) {
                processEventFail(eventId, "main", e.getMessage(), PlaywrightUtil.safePageContent(page), captureScreenshotBase64(page));
                log.warning(withPrefix("processEvent.withPlaywright",
                        "Crawl event failed: eventId=%d, error=%s".formatted(evt.getEventId(), e.getMessage())));
            } finally {
                log.info(withPrefix("processEvent.withPlaywright",
                        "Crawl event done: eventId=%d, eventName=%s took %d ms".formatted(
                                evt.getEventId(), evt.getEventName(), System.currentTimeMillis() - start)));
            }
        });
    }

    private void openMatchPage(Page page, Event event) {
        page.navigate(event.getLink().replace(Constants.AI_SCORE_URL, Constants.M_AI_SCORE_URL));
    }

    private boolean processFullTimeEvent(Page page, Event event) {
        var tabTexts = getMatchPageTabTexts(page);
        boolean statsTabPresent = hasTabLabel(tabTexts, "Stats");
        boolean oddTabPresent = hasTabLabel(tabTexts, "Odds");

        if (!statsTabPresent) {
            var description = withPrefix("processFullTimeEvent.statsTabPresent"
                    , "No Stats tab on match page; tabs found: %s of event_id = %s".formatted(tabTexts, event.getEventId())
            );
            log.warning(description);
            recordEventMissingStats(event.getEventId(), description);
        }
        var statsFuture = statsTabPresent && !oddTabPresent
                ? CompletableFuture.supplyAsync(() -> crawlStatEvents(event))
                : CompletableFuture.completedFuture(true);

        if (!oddTabPresent) {
            var description = withPrefix("processFullTimeEvent.oddTabPresent"
                    , "No Odds tab on match page; tabs found: %s of event_id = %s".formatted(tabTexts, event.getEventId())
            );
            log.warning(description);
            recordEventNoOdds(event.getEventId(), description);
        }
        var oddsFuture = oddTabPresent
                ? CompletableFuture.supplyAsync(() -> crawlOddEvents(event))
                : CompletableFuture.completedFuture(true);

        return awaitParallelCrawls(event.getEventId(), statsFuture, oddsFuture);
    }

    private boolean processNonFullTimeEvent(Page page, Event event) {
        if (!hasTabLabel(getMatchPageTabTexts(page), "Odds")) {
            recordEventNoOdds(event.getEventId(), "No Odds tab on match page for non-FT event");
            return true;
        }
        return crawlOddEvents(event);
    }

    private List<String> getMatchPageTabTexts(Page page) {
        page.waitForTimeout(400); // wait for page load before next action
        return page.locator("div[role=tablist] div[role=tab]").allInnerTexts().stream().filter(StringUtil::isNotEmpty).toList();
    }

    private boolean hasTabLabel(List<String> tabTexts, String expectedLabel) {
        return tabTexts.stream().anyMatch(expectedLabel::equalsIgnoreCase);
    }

    private boolean awaitParallelCrawls(
            long eventId,
            CompletableFuture<Boolean> statsFuture,
            CompletableFuture<Boolean> oddsFuture
    ) {
        try {
            CompletableFuture.allOf(statsFuture, oddsFuture)
                    .orTimeout(PARALLEL_CRAWL_TIMEOUT_MINUTES, TimeUnit.MINUTES)
                    .join();
            return statsFuture.join() && oddsFuture.join();
        } catch (CompletionException ex) {
            Throwable cause = ex.getCause();
            if (cause instanceof TimeoutException) {
                log.warning(withPrefix("awaitParallelCrawls",
                        "Parallel crawl timeout (%d min): eventId=%d"
                                .formatted(PARALLEL_CRAWL_TIMEOUT_MINUTES, eventId)));
                processEventFail(eventId, "main",
                        "Parallel crawl exceeded %d min".formatted(PARALLEL_CRAWL_TIMEOUT_MINUTES),
                        "Waiting for stats and odds crawls to complete",
                        null);
                return false;
            }
            throw ex;
        }
    }

    private void markEventCrawlSuccess(long eventId) {
        jdbcTemplate.update(SQL_DELETE_CRAWL_FAIL_SUCCESS, Map.of("event_id", eventId));
        releaseProducerEventClaim(eventId);
    }

    private void releaseProducerEventClaim(long eventId) {
        jdbcTemplate.update(SQL_DELETE_EVENT_CLAIM_PRODUCER,
                Map.of("event_id", eventId, "claimed_by", EVENT_CLAIM_BY_PRODUCER));
    }

    private void recordEventNoOdds(long eventId, String description) {
        recordEventDataIssue(eventId, "missing_odds", description);
    }

    private void recordEventMissingStats(long eventId, String description) {
        recordEventDataIssue(eventId, "missing_stats", description);
    }

    private void recordEventDataIssue(long eventId, String issueType, String description) {
        var safeDescription = truncateForEventDataIssue(description);
        jdbcTemplate.update(SQL_UPSERT_EVENT_DATA_ISSUE,
                new MapSqlParameterSource("eventId", eventId)
                        .addValue("issueType", issueType)
                        .addValue("description", safeDescription)
                        .addValue("recordedAt", LocalDateTime.now()));
    }

    private String truncateForEventDataIssue(String description) {
        if (description == null || description.length() <= EVENT_DATA_ISSUE_DESCRIPTION_MAX_LENGTH) {
            return description;
        }
        var suffix = "... [truncated]";
        int maxPrefixLength = EVENT_DATA_ISSUE_DESCRIPTION_MAX_LENGTH - suffix.length();
        return description.substring(0, Math.max(0, maxPrefixLength)) + suffix;
    }

    private void processEventFail(Long eventId, String type, String message, String html, String screenshot) {
        var sql = """
                insert into event_crawl_failed(event_id, type, message, html, screenshot)
                VALUES (:eventId, :type, :message, :html, :screenshot)
                on duplicate key update message = values(message), html = values(html), screenshot = values(screenshot)
                """;
        jdbcTemplate.update(sql, Map.of(
                "eventId", eventId,
                "type", type,
                "message", message,
                "html", html,
                "screenshot", screenshot
        ));
    }

    /**
     * @return true nếu crawl stats thành công, false nếu lỗi (đã gọi processEventFail).
     */
    private boolean crawlStatEvents(Event event) {
        boolean[] ok = {true};
        PlaywrightUtil.withPlaywright(event, (page, evt) -> {
            log.info(withPrefix("crawlStatEvents", "Crawl stats start: eventId=%d".formatted(evt.getEventId())));
            long start = System.currentTimeMillis();
            try {
                page.navigate(
                        evt.getLink().concat("/stats").replace(Constants.AI_SCORE_URL, Constants.M_AI_SCORE_URL)
                );
                page.waitForTimeout(400);
                var tabs = page.locator(".btnBox > span");
                int tabCount = tabs.count();
                if (tabCount < 2) {
                    log.warning(withPrefix("crawlStatEvents",
                            "Crawl stats skip: eventId=%d (need Match + 1st Half)".formatted(evt.getEventId())));
                    recordEventMissingStats(
                            evt.getEventId(),
                            "Not enough tabs in stats view: found %d, expected at least 2 (Match and 1st Half) with HTML: %s".formatted(tabCount, safeLocatorHtml(tabs))
                    );
                    ok[0] = false;
                    return;
                }
                // Tab 0 = Match (FT), tab 1 = 1st Half (HT)
                tabs.nth(0).click();
                page.waitForTimeout(400); // wait for tab click before next action

                String matchHtml = PlaywrightUtil.safePageContent(page);
                if (StringUtil.isEmpty(matchHtml)) {
                    recordEventMissingStats(
                            evt.getEventId(),
                            "Cannot read Match tab html in stats view (page likely navigating)"
                    );
                    ok[0] = false;
                    return;
                }
                Document docMatch = Jsoup.parse(matchHtml);
                Map<String, int[]> ftStats = parseStatsView(docMatch);

                tabs.nth(1).click();
                page.waitForTimeout(400); // wait for tab click before next action
                String firstHalfHtml = PlaywrightUtil.safePageContent(page);
                if (StringUtil.isEmpty(firstHalfHtml)) {
                    recordEventMissingStats(
                            evt.getEventId(),
                            "Cannot read 1st Half tab html in stats view (page likely navigating)"
                    );
                    ok[0] = false;
                    return;
                }
                Document doc1stHalf = Jsoup.parse(firstHalfHtml);
                Map<String, int[]> htStats = parseStatsView(doc1stHalf);

                MapSqlParameterSource params = toEventStatsParams(evt.getEventId(), htStats, ftStats);
                jdbcTemplate.update(SQL_UPDATE_EVENT_RESULT_STATS, params);
                log.info(withPrefix("crawlStatEvents", "Crawl stats saved: eventId=%d".formatted(evt.getEventId())));
            } catch (Exception e) {
                processEventFail(evt.getEventId(), "stats", e.getMessage(), PlaywrightUtil.safePageContent(page), captureScreenshotBase64(page));
                ok[0] = false;
            } finally {
                log.info(withPrefix("crawlStatEvents",
                        "Crawl stats done: eventId=%d took %d ms".formatted(evt.getEventId(), System.currentTimeMillis() - start)));
            }
        });
        return ok[0];
    }

    /**
     * Parse một view (Match hoặc 1st Half) thành map: key = total_shot | shot_on_target | corner | yellow_card | foul | offside, value = [home, away].
     */
    private Map<String, int[]> parseStatsView(Document doc) {
        Map<String, int[]> out = new HashMap<>();
        // Total Shots: .totalShots .num.homeNum, .num.awayNum
        Element totalShots = doc.selectFirst("p.totalShots");
        if (totalShots != null) {
            int home = parseFirstInt(totalShots.selectFirst(".num.homeNum"));
            int away = parseFirstInt(totalShots.selectFirst(".num.awayNum"));
            out.put("total_shot", new int[]{home, away});
        }
        // Shots on target: .ballPossession2 .textBottom .num
        Element textBottom = doc.selectFirst(".ballPossession2 .textBottom");
        if (textBottom != null) {
            Elements nums = textBottom.select(".num");
            int home = !nums.isEmpty() ? parseFirstInt(nums.getFirst()) : 0;
            int away = nums.size() >= 2 ? parseFirstInt(nums.get(1)) : 0;
            out.put("shot_on_target", new int[]{home, away});
        }
        // statsData li: Corner Kicks, Yellow Cards, Fouls, Offsides
        Map<String, String> labelToKey = Map.of(
                "Corner Kicks", "corner",
                "Yellow Cards", "yellow_card",
                "Fouls", "foul",
                "Offsides", "offside"
        );
        for (Element li : doc.select("ul.statsData li")) {
            String label = li.ownText();
            if (label.isBlank()) continue;
            String normalized = label.trim().replaceAll("\\s+", " ");
            String key = labelToKey.get(normalized);
            if (key == null) continue;
            int home = parseFirstInt(li.selectFirst(".num.homeNum"));
            int away = parseFirstInt(li.selectFirst(".num.awayNum"));
            out.put(key, new int[]{home, away});
        }
        return out;
    }

    private static int parseFirstInt(Element el) {
        if (el == null) return 0;
        String t = el.text();
        if (t.isBlank()) return 0;
        var m = FIRST_INT.matcher(t.trim());
        return m.find() ? Integer.parseInt(m.group(1)) : 0;
    }

    /**
     * Chỉ thêm cột gốc (home/away); event_result.*_total_* là generated, không set.
     */
    private MapSqlParameterSource toEventStatsParams(Long eventId, Map<String, int[]> ht, Map<String, int[]> ft) {
        MapSqlParameterSource p = new MapSqlParameterSource("event_id", eventId);
        for (String key : List.of("corner", "yellow_card", "foul", "offside", "total_shot", "shot_on_target")) {
            int[] htVal = ht.getOrDefault(key, new int[]{0, 0});
            int[] ftVal = ft.getOrDefault(key, new int[]{0, 0});
            p.addValue("ht_home_" + key, htVal[0]);
            p.addValue("ht_away_" + key, htVal[1]);
            p.addValue("ft_home_" + key, ftVal[0]);
            p.addValue("ft_away_" + key, ftVal[1]);
        }
        return p;
    }

    /**
     * @return true nếu crawl odds thành công, false nếu lỗi (đã gọi processEventFail).
     */
    private boolean crawlOddEvents(Event event) {
        boolean[] ok = {true};
        PlaywrightUtil.withPlaywright(event, (page, evt) -> {
            long start = System.currentTimeMillis();
            try {
                log.info(withPrefix("crawlOddEvents", "Crawl odds start: eventId=%d".formatted(evt.getEventId())));
                var listTabOdds = Map.of("asian handicap", "hdc", "total goals", "ou", "total corners", "corner");

                page.navigate(
                        evt.getLink().concat("/odds").replace(Constants.AI_SCORE_URL, Constants.M_AI_SCORE_URL)
                );
                page.waitForTimeout(400); // wait for page load before next action

                var oddTypeBox = page.locator(".oddTypesBox");
                if (oddTypeBox.count() == 0) {
                    var description = withPrefix("crawlOddEvents",
                            "No oddTypesBox on page for event_id = %d".formatted(evt.getEventId()));
                    log.warning(description);
                    recordEventNoOdds(evt.getEventId(), description);
                    return;
                }

                var tabOdds = page.locator(".oddTypesBox span");
                int count = tabOdds.count();
                if (count == 0) {
                    var description = withPrefix("crawlOddEvents",
                            "No odds tabs in oddTypesBox for event_id = %d".formatted(evt.getEventId()));
                    log.warning(description);
                    recordEventNoOdds(evt.getEventId(), description);
                    return;
                }

                AtomicBoolean hasAsianHandicap = new AtomicBoolean(false);
                AtomicBoolean hasTotalGoals = new AtomicBoolean(false);
                var tabOddsText = tabOdds.allInnerTexts();
                tabOddsText.forEach(t -> {
                    String norm = StringUtil.normalizeText(t);
                    var logFoundTabMsg = withPrefix("crawlOddEvents", "Found odds tab: eventId=%d, tab=%s".formatted(evt.getEventId(), norm));
                    log.info(logFoundTabMsg);
                    if ("asian handicap".equalsIgnoreCase(norm)) {
                        hasAsianHandicap.set(true);
                    }
                    if ("total goals".equalsIgnoreCase(norm)) {
                        hasTotalGoals.set(true);
                    }
                });

                if (!hasAsianHandicap.get() || !hasTotalGoals.get()) {
                    var description = withPrefix("crawlOddEvents", "Missing required odds tabs for event_id = %d: hasAsianHandicap=%b, hasTotalGoals=%b".formatted(
                            evt.getEventId(), hasAsianHandicap.get(), hasTotalGoals.get()
                    ));
                    log.warning(description);
                    recordEventNoOdds(evt.getEventId(), description);
                    return;
                }

                deleteOddsForEvent(evt.getEventId());

                var savedAny = new AtomicBoolean(false);
                var isOpenModal = new AtomicBoolean(false);
                tabOdds.all().forEach(tab -> {
                    if (isOpenModal.get()) {
                        var x = page.locator(".van-popup i.iconfont.icon-guanbi");
                        x.click();
                        page.waitForTimeout(300); // wait for modal close before next tab click
                        isOpenModal.set(false);
                    }
                    String tabNormalize = StringUtil.normalizeText(tab.innerText());
                    for (var e : listTabOdds.entrySet()) {
                        if (!e.getKey().equalsIgnoreCase(tabNormalize)) continue;
                        tab.click();
                        page.waitForTimeout(300); // wait for tab click before next action
                        String market = e.getValue();
                        var oddProvider = page.locator(".oddsBox .oddsBoxRight");
                        if (oddProvider.count() == 0) {
                            var description = withPrefix("crawlOddEvents",
                                    "No odds provider box for market %s on event_id = %d"
                                            .formatted(market, evt.getEventId()));
                            log.warning(description);
                            recordEventNoOdds(evt.getEventId(), description);
                            return;
                        }
                        if (!clickFirstVisible(oddProvider)) {
                            var description = withPrefix("crawlOddEvents",
                                    "Cannot click any visible odds provider for market %s on event_id = %d"
                                            .formatted(market, evt.getEventId()));
                            log.warning(description);
                            recordEventNoOdds(evt.getEventId(), description);
                            return;
                        }
                        isOpenModal.set(true);
                        page.waitForTimeout(1200); // wait for modal open
                        var listLi = page.locator(".oddContent li");
                        if (listLi.count() == 0) {
                            var description = withPrefix("crawlOddEvents",
                                    "No odds entries in odds provider box for market %s on event_id = %d"
                                            .formatted(market, evt.getEventId()));
                            log.warning(description);
                            recordEventNoOdds(evt.getEventId(), description);
                            return;
                        }
                        var timelineItems = listLi.all().stream()
                                .map(li -> new EventOddsTimeline(li, market))
                                .filter(it -> it.getPriceA() != null || it.getPriceB() != null || StringUtil.isNotEmpty(it.getLine()))
                                .toList();

                        log.info(withPrefix("crawlOddEvents",
                                "Crawl odds: eventId=%d, market=%s, items=%d".formatted(evt.getEventId(), market, timelineItems.size())));
                        if (!timelineItems.isEmpty()) {
                            persistOddsForMarket(evt.getEventId(), market, timelineItems);
                            savedAny.set(true);
                        }
                    }
                });

                if (!savedAny.get()) {
                    recordEventNoOdds(
                            evt.getEventId(),
                            "Crawled odds but no valid odds entries found for any market"
                    );
                }
            } catch (Exception e) {
                processEventFail(evt.getEventId(), "odds", e.getMessage(), PlaywrightUtil.safePageContent(page), captureScreenshotBase64(page));
                ok[0] = false;
                log.warning(withPrefix("crawlOddEvents",
                        "Crawl odds failed: eventId=%d, error=%s".formatted(evt.getEventId(), e.getMessage())));
            } finally {
                log.info(withPrefix("crawlOddEvents",
                        "Crawl odds done: eventId=%d took %d ms".formatted(evt.getEventId(), System.currentTimeMillis() - start)));
            }
        });
        return ok[0];
    }

    private void deleteOddsForEvent(Long eventId) {
        int timelineDeleted = jdbcTemplate.update(SQL_DELETE_EVENT_ODDS_TIMELINE, Map.of("event_id", eventId));
        int oddsDeleted = jdbcTemplate.update(SQL_DELETE_EVENT_ODDS, Map.of("event_id", eventId));
        var description = withPrefix(
                "deleteOddsForEvent",
                "Deleted existing odds for event_id = %d: timeline rows deleted = %d, event_odds rows deleted = %d".formatted(eventId, timelineDeleted, oddsDeleted)
        );
        log.info(description);
    }


    private void persistOddsForMarket(Long eventId, String market, List<EventOddsTimeline> timelineItems) {
        if (CollectionUtils.isEmpty(timelineItems)) {
            log.warning(withPrefix("persistOddsForMarket",
                    "persistOddsForMarket skip: eventId=%d, market=%s, empty timeline".formatted(eventId, market)));
            return;
        }
        var now = LocalDateTime.now();
        var timelineParams = timelineItems.stream()
                .map(t -> toTimelineParams(eventId, market, t, now))
                .toList();
        JdbcBatchUtils.batchInsertSafe(jdbcTemplate, SQL_INSERT_EVENT_ODDS_TIMELINE, timelineParams);
        log.info(withPrefix("persistOddsForMarket",
                "persistOdds: eventId=%d, market=%s, timeline inserted=%d".formatted(eventId, market, timelineParams.size())));

        var openCandidate = timelineItems.getLast();
        var preMatchCandidate = pickPreMatchCandidate(timelineItems);
        jdbcTemplate.update(SQL_INSERT_EVENT_ODDS, toEventOddsParams(eventId, "open", market, openCandidate));
        jdbcTemplate.update(SQL_INSERT_EVENT_ODDS, toEventOddsParams(eventId, "pre-match", market, preMatchCandidate));

        var halfTimeCandidate = pickHalfTimeCandidate(timelineItems);
        if (halfTimeCandidate != null) {
            jdbcTemplate.update(SQL_INSERT_EVENT_ODDS, toEventOddsParams(eventId, "half-time", market, halfTimeCandidate.timeline()));
            log.info(withPrefix("persistOddsForMarket",
                    "persistOdds: eventId=%d, market=%s, open+pre-match+half-time source=%s"
                            .formatted(eventId, market, halfTimeCandidate.source())));
            return;
        }
        log.info(withPrefix("persistOddsForMarket",
                "persistOdds: eventId=%d, market=%s, open+pre-match (no half-time candidate)".formatted(eventId, market)));
    }

    private EventOddsTimeline pickPreMatchCandidate(List<EventOddsTimeline> timelineItems) {
        return timelineItems.stream()
                .filter(it -> StringUtil.isNotEmpty(it.getDate()))
                .findFirst()
                .orElse(timelineItems.getFirst());
    }

    private HalfTimeCandidate pickHalfTimeCandidate(List<EventOddsTimeline> timelineItems) {
        var directHt = timelineItems.stream()
                .filter(t -> StringUtil.isNotEmpty(t.getMatchMinute()) && "ht".equalsIgnoreCase(t.getMatchMinute().trim()))
                .findFirst()
                .orElse(null);
        if (directHt != null) {
            return new HalfTimeCandidate(directHt, "direct_ht");
        }

        EventOddsTimeline minute45Newest = null;
        EventOddsTimeline nearestUnder45 = null;
        Integer nearestUnder45Minute = null;
        for (EventOddsTimeline item : timelineItems) {
            Integer minuteValue = parseMatchMinuteValue(item.getMatchMinute());
            if (minuteValue == null) continue;
            if (minuteValue == 45) {
                minute45Newest = item;
                continue;
            }
            if (minuteValue > 45) continue;
            if (nearestUnder45Minute == null || minuteValue >= nearestUnder45Minute) {
                nearestUnder45Minute = minuteValue;
                nearestUnder45 = item;
            }
        }
        if (minute45Newest != null) {
            return new HalfTimeCandidate(minute45Newest, "fallback_minute_45_latest");
        }
        if (nearestUnder45 != null) {
            return new HalfTimeCandidate(nearestUnder45, "fallback_nearest_minute_under_45");
        }
        return null;
    }

    private Integer parseMatchMinuteValue(String minuteText) {
        if (StringUtil.isEmpty(minuteText)) return null;
        String normalized = minuteText.trim();
        if ("ht".equalsIgnoreCase(normalized)) return null;
        var matcher = FIRST_INT.matcher(normalized);
        if (!matcher.find()) return null;
        return Integer.parseInt(matcher.group(1));
    }

    private record HalfTimeCandidate(EventOddsTimeline timeline, String source) {
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
