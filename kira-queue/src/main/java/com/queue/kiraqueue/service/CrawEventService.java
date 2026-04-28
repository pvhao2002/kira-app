package com.queue.kiraqueue.service;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.queue.kiraqueue.dto.Event;
import com.queue.kiraqueue.dto.model.EventOddsTimeline;
import com.queue.kiraqueue.util.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.logging.Level;
import java.util.regex.Pattern;

@Log
@Service
@RequiredArgsConstructor(onConstructor_ = @Autowired)
public class CrawEventService {
    private final NamedParameterJdbcTemplate jdbcTemplate;

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

    /** Cập nhật stats vào event_result (chỉ cột gốc; *_total_* là generated column, không set). */
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

    public void processEvent(Long eventId) {
        var sqlGetEvent = "select event_id , link , event_name from events where event_id = :eid";
        var event = jdbcTemplate.query(sqlGetEvent, Map.of("eid", eventId), BeanPropertyRowMapper.newInstance(Event.class)).stream().findFirst().orElse(null);
        if (event == null) {
            log.log(Level.WARNING, "Event {0} not found", eventId);
            return;
        }
        PlaywrightUtil.withPlaywright(event, (page, evt) -> {
            long start = System.currentTimeMillis();
            try {
                log.info("Crawl event start: eventId=%d, eventName=%s".formatted(event.getEventId(), event.getEventName()));
                page.navigate(
                        event.getLink().replace(Constants.AI_SCORE_URL, Constants.M_AI_SCORE_URL)
                );
                PlaywrightUtil.waitDomContentLoaded(page);
                PlaywrightUtil.removeAcceptAll(page);
                page.waitForSelector("[role=tab]");
                var statsFuture = CompletableFuture.supplyAsync(() -> crawlStatEvents(evt));
                var oddsFuture = CompletableFuture.supplyAsync(() -> crawlOddEvents(evt));
                boolean statsOk = statsFuture.join();
                boolean oddsOk = oddsFuture.join();
                // Chỉ xóa khỏi event_crawl_failed khi cả stats và odds đều success (async có thể đã gọi processEventFail)
                if (statsOk && oddsOk) {
                    jdbcTemplate.update("""
                            delete from event_crawl_failed
                            where event_id = :event_id
                            """, Map.of("event_id", evt.getEventId()));
                }
            } catch (Exception e) {
                processEventFail(eventId, "main", e.getMessage());
                log.warning("Crawl event failed: eventId=%d, error=%s".formatted(event.getEventId(), e.getMessage()));
            } finally {
                log.info("Crawl event done: eventId=%d, eventName=%s took %d ms".formatted(event.getEventId(), event.getEventName(), System.currentTimeMillis() - start));
            }
        });
    }

    private void processEventFail(Long eventId, String type, String message) {
        var sql = """
                insert into event_crawl_failed(event_id, type, message)
                VALUES (:eventId, :type, :message)
                on duplicate key update message = values(message)
                """;
        jdbcTemplate.update(sql, Map.of("eventId", eventId, "type", type, "message", message));
    }

    /** @return true nếu crawl stats thành công, false nếu lỗi (đã gọi processEventFail). */
    private boolean crawlStatEvents(Event event) {
        boolean[] ok = { true };
        PlaywrightUtil.withPlaywright(event, (page, evt) -> {
            log.info("Crawl stats start: eventId=%d".formatted(evt.getEventId()));
            long start = System.currentTimeMillis();
            try {
                page.navigate(
                        event.getLink().concat("/stats").replace(Constants.AI_SCORE_URL, Constants.M_AI_SCORE_URL)
                );
                PlaywrightUtil.waitDomContentLoaded(page);
                PlaywrightUtil.removeAcceptAll(page);
                page.waitForSelector(".statsBox .btnBox", new Page.WaitForSelectorOptions().setTimeout(15_000));
                var tabs = page.locator(".btnBox > span");
                int tabCount = tabs.count();
                if (tabCount < 2) {
                    log.warning("Crawl stats skip: eventId=%d, tabs=%d (need Match + 1st Half)".formatted(event.getEventId(), tabCount));
                    jdbcTemplate.update(INSERT_EVENT_FAIL, new MapSqlParameterSource("event_id", event.getEventId())
                            .addValue("mess", "Not enough tabs for stats")
                            .addValue("html", page.content()));
                    ok[0] = false;
                    return;
                }
                // Tab 0 = Match (FT), tab 1 = 1st Half (HT)
                tabs.nth(0).click();
                page.waitForTimeout(400);
                Document docMatch = Jsoup.parse(page.content());
                Map<String, int[]> ftStats = parseStatsView(docMatch);

                tabs.nth(1).click();
                page.waitForTimeout(400);
                Document doc1stHalf = Jsoup.parse(page.content());
                Map<String, int[]> htStats = parseStatsView(doc1stHalf);

                MapSqlParameterSource params = toEventStatsParams(evt.getEventId(), htStats, ftStats);
                jdbcTemplate.update(SQL_UPDATE_EVENT_RESULT_STATS, params);
                log.info("Crawl stats saved: eventId=%d".formatted(evt.getEventId()));
            } catch (Exception e) {
                processEventFail(evt.getEventId(), "stats", e.getMessage());
                ok[0] = false;
            } finally {
                log.info("Crawl stats done: eventId=%d took %d ms".formatted(evt.getEventId(), System.currentTimeMillis() - start));
            }
        });
        return ok[0];
    }

    /** Parse một view (Match hoặc 1st Half) thành map: key = total_shot | shot_on_target | corner | yellow_card | foul | offside, value = [home, away]. */
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
            int home = !nums.isEmpty() ? parseFirstInt(nums.get(0)) : 0;
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

    /** Chỉ thêm cột gốc (home/away); event_result.*_total_* là generated, không set. */
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

    /** @return true nếu crawl odds thành công, false nếu lỗi (đã gọi processEventFail). */
    private boolean crawlOddEvents(Event event) {
        boolean[] ok = { true };
        PlaywrightUtil.withPlaywright(event, (page, evt) -> {
            long start = System.currentTimeMillis();
            try {
                log.info("Crawl odds start: eventId=%d".formatted(event.getEventId()));
                var listTabOdds = Map.of("asian handicap", "hdc", "total goals", "ou", "total corners", "corner");
                page.navigate(
                        event.getLink().concat("/odds").replace(Constants.AI_SCORE_URL, Constants.M_AI_SCORE_URL)
                );
                page.waitForSelector(".oddTypesBox span");
                var tabOdds = page.locator(".oddTypesBox span");
                int count = tabOdds.count();
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
                                .filter(it -> it.getPriceA() != null && it.getPriceB() != null)
                                .toList();
                        log.info("Crawl odds: eventId=%d, market=%s, timelineItems=%d".formatted(evt.getEventId(), market, timelineItems.size()));
                        persistOddsForMarket(evt.getEventId(), market, timelineItems);
                    }
                }
            } catch (Exception e) {
                processEventFail(evt.getEventId(), "odds", e.getMessage());
                ok[0] = false;
                log.warning("Crawl odds failed: eventId=%d, error=%s".formatted(evt.getEventId(), e.getMessage()));
            } finally {
                log.info("Crawl odds done: eventId=%d took %d ms".formatted(evt.getEventId(), System.currentTimeMillis() - start));
            }
        });
        return ok[0];
    }

    private void deleteOddsForEvent(Long eventId) {
        int timelineDeleted = jdbcTemplate.update(SQL_DELETE_EVENT_ODDS_TIMELINE, Map.of("event_id", eventId));
        int oddsDeleted = jdbcTemplate.update(SQL_DELETE_EVENT_ODDS, Map.of("event_id", eventId));
        log.info("Delete odds for regen: eventId=%d, event_odds_timeline=%d, event_odds=%d".formatted(eventId, timelineDeleted, oddsDeleted));
    }


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

        var openCandidate = timelineItems.getLast();
        var preMatchCandidate = pickPreMatchCandidate(timelineItems);
        jdbcTemplate.update(SQL_INSERT_EVENT_ODDS, toEventOddsParams(eventId, "open", market, openCandidate));
        jdbcTemplate.update(SQL_INSERT_EVENT_ODDS, toEventOddsParams(eventId, "pre-match", market, preMatchCandidate));

        var halfTimeCandidate = pickHalfTimeCandidate(timelineItems);
        if (halfTimeCandidate != null) {
            jdbcTemplate.update(SQL_INSERT_EVENT_ODDS, toEventOddsParams(eventId, "half-time", market, halfTimeCandidate.timeline()));
            log.info("persistOdds: eventId=%d, market=%s, open+pre-match+half-time source=%s"
                    .formatted(eventId, market, halfTimeCandidate.source()));
            return;
        }
        log.info("persistOdds: eventId=%d, market=%s, open+pre-match (no half-time candidate)".formatted(eventId, market));
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

    private record HalfTimeCandidate(EventOddsTimeline timeline, String source) {}

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
