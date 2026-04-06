package kira.crawl.app.service;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import kira.crawl.app.client.GatewayClient;
import kira.crawl.app.dto.EventInfoResponse;
import kira.crawl.app.dto.EventOddsTimeline;
import kira.crawl.app.dto.OddsTimelineItemDTO;
import kira.crawl.app.util.Constants;
import kira.crawl.app.util.PlaywrightUtil;
import kira.crawl.app.util.StringUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.logging.Level;
import java.util.regex.Pattern;

@Log
@Service
@RequiredArgsConstructor
public class CrawlEventService {

    private final GatewayClient gatewayClient;

    private static final Pattern FIRST_INT = Pattern.compile("(\\d+)");

    public void processEvent(long eventId) {
        var eventOpt = gatewayClient.getEventInfo(eventId);
        if (eventOpt.isEmpty()) {
            log.log(Level.WARNING, "Event {0} not found via gateway", eventId);
            return;
        }

        var event = eventOpt.get();
        PlaywrightUtil.withPlaywright(event, (page, evt) -> {
            long start = System.currentTimeMillis();
            try {
                log.info("Crawl event start: eventId=%d, eventName=%s".formatted(evt.eventId(), evt.eventName()));
                page.navigate(
                        evt.link().replace(Constants.AI_SCORE_URL, Constants.M_AI_SCORE_URL)
                );
                PlaywrightUtil.waitDomContentLoaded(page);
                PlaywrightUtil.removeAcceptAll(page);
                page.waitForSelector("[role=tab]");

                var statsFuture = CompletableFuture.supplyAsync(() -> crawlStatEvents(evt));
                var oddsFuture = CompletableFuture.supplyAsync(() -> crawlOddEvents(evt));
                boolean statsOk = statsFuture.join();
                boolean oddsOk = oddsFuture.join();

                if (statsOk && oddsOk) {
                    gatewayClient.clearCrawlFail(evt.eventId());
                }
            } catch (Exception e) {
                gatewayClient.reportCrawlFail(eventId, "main", e.getMessage());
                log.warning("Crawl event failed: eventId=%d, error=%s".formatted(evt.eventId(), e.getMessage()));
            } finally {
                log.info("Crawl event done: eventId=%d, eventName=%s took %d ms".formatted(
                        evt.eventId(), evt.eventName(), System.currentTimeMillis() - start));
            }
        });
    }

    private boolean crawlStatEvents(EventInfoResponse event) {
        boolean[] ok = {true};
        PlaywrightUtil.withPlaywright(event, (page, evt) -> {
            log.info("Crawl stats start: eventId=%d".formatted(evt.eventId()));
            long start = System.currentTimeMillis();
            try {
                page.navigate(
                        evt.link().concat("/stats").replace(Constants.AI_SCORE_URL, Constants.M_AI_SCORE_URL)
                );
                PlaywrightUtil.waitDomContentLoaded(page);
                PlaywrightUtil.removeAcceptAll(page);
                page.waitForSelector(".statsBox .btnBox", new Page.WaitForSelectorOptions().setTimeout(15_000));
                var tabs = page.locator(".btnBox > span");
                int tabCount = tabs.count();
                if (tabCount < 2) {
                    log.warning("Crawl stats skip: eventId=%d, tabs=%d (need Match + 1st Half)".formatted(evt.eventId(), tabCount));
                    gatewayClient.reportCrawlFail(evt.eventId(), "stats", "Not enough tabs for stats");
                    ok[0] = false;
                    return;
                }

                tabs.nth(0).click();
                page.waitForTimeout(400);
                Document docMatch = Jsoup.parse(page.content());
                Map<String, int[]> ftStats = parseStatsView(docMatch);

                tabs.nth(1).click();
                page.waitForTimeout(400);
                Document doc1stHalf = Jsoup.parse(page.content());
                Map<String, int[]> htStats = parseStatsView(doc1stHalf);

                gatewayClient.persistEventStats(evt.eventId(), htStats, ftStats);
                log.info("Crawl stats saved: eventId=%d".formatted(evt.eventId()));
            } catch (Exception e) {
                gatewayClient.reportCrawlFail(evt.eventId(), "stats", e.getMessage());
                ok[0] = false;
            } finally {
                log.info("Crawl stats done: eventId=%d took %d ms".formatted(evt.eventId(), System.currentTimeMillis() - start));
            }
        });
        return ok[0];
    }

    private Map<String, int[]> parseStatsView(Document doc) {
        Map<String, int[]> out = new HashMap<>();
        Element totalShots = doc.selectFirst("p.totalShots");
        if (totalShots != null) {
            int home = parseFirstInt(totalShots.selectFirst(".num.homeNum"));
            int away = parseFirstInt(totalShots.selectFirst(".num.awayNum"));
            out.put("total_shot", new int[]{home, away});
        }
        Element textBottom = doc.selectFirst(".ballPossession2 .textBottom");
        if (textBottom != null) {
            Elements nums = textBottom.select(".num");
            int home = !nums.isEmpty() ? parseFirstInt(nums.get(0)) : 0;
            int away = nums.size() >= 2 ? parseFirstInt(nums.get(1)) : 0;
            out.put("shot_on_target", new int[]{home, away});
        }
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

    private boolean crawlOddEvents(EventInfoResponse event) {
        boolean[] ok = {true};
        PlaywrightUtil.withPlaywright(event, (page, evt) -> {
            long start = System.currentTimeMillis();
            try {
                log.info("Crawl odds start: eventId=%d".formatted(evt.eventId()));
                var listTabOdds = Map.of("asian handicap", "hdc", "total goals", "ou", "total corners", "corner");

                page.navigate(
                        evt.link().concat("/odds").replace(Constants.AI_SCORE_URL, Constants.M_AI_SCORE_URL)
                );
                page.waitForSelector(".oddTypesBox span");
                var tabOdds = page.locator(".oddTypesBox span");
                int count = tabOdds.count();
                gatewayClient.deleteEventOdds(evt.eventId());

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

                        List<OddsTimelineItemDTO> dtos = timelineItems.stream()
                                .map(EventOddsTimeline::toDTO)
                                .toList();

                        log.info("Crawl odds: eventId=%d, market=%s, items=%d".formatted(evt.eventId(), market, dtos.size()));
                        gatewayClient.persistEventOdds(evt.eventId(), market, dtos);
                    }
                }
            } catch (Exception e) {
                gatewayClient.reportCrawlFail(evt.eventId(), "odds", e.getMessage());
                ok[0] = false;
                log.warning("Crawl odds failed: eventId=%d, error=%s".formatted(evt.eventId(), e.getMessage()));
            } finally {
                log.info("Crawl odds done: eventId=%d took %d ms".formatted(evt.eventId(), System.currentTimeMillis() - start));
            }
        });
        return ok[0];
    }
}
