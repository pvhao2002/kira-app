package kira.crawl.app.service;

import com.microsoft.playwright.Page;
import kira.crawl.app.client.GatewayClient;
import kira.crawl.app.dto.CrawledEventDTO;
import kira.crawl.app.dto.EventHtml;
import kira.crawl.app.util.Constants;
import kira.crawl.app.util.PlaywrightUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.jsoup.Jsoup;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.logging.Level;

@Log
@Service
@RequiredArgsConstructor
public class CrawlDateService {

    private final GatewayClient gatewayClient;

    public void crawlDate(List<String> dates) {
        PlaywrightUtil.withPlaywright(dates, (page, mDates) -> mDates.forEach(date -> {
            log.info("Start crawl date: " + date);
            long totalEvents = 0;
            var startTime = System.currentTimeMillis();
            var eventQueue = new ArrayList<EventHtml>();

            gatewayClient.updateCrawlDateStatus(date, "in_progress", 0, null);

            try {
                page.navigate(Constants.AI_SCORE_URL + "%s".formatted(date));
                PlaywrightUtil.waitDomContentLoaded(page);
                var allBtn = page.locator("span.changeItem", new Page.LocatorOptions().setHasText("All"));
                allBtn.click();
                page.locator("span.sortByText", new Page.LocatorOptions().setHasText("Sort by time"))
                        .click();
                PlaywrightUtil.waitDomContentLoaded(page);

                crawlEvents(page, eventQueue);

                List<EventHtml> distinctEvents = eventQueue.stream().distinct().toList();
                List<CrawledEventDTO> dtos = distinctEvents.stream()
                        .map(EventHtml::toCrawledEventDTO)
                        .toList();

                gatewayClient.persistCrawledEvents(dtos);
                totalEvents = distinctEvents.size();

                gatewayClient.updateCrawlDateStatus(date, "done", (int) totalEvents, null);
            } catch (Exception ex) {
                log.log(Level.WARNING, "Error during crawl date: " + date, ex);
                gatewayClient.updateCrawlDateStatus(date, "failed", 0, ex.getMessage());
            } finally {
                log.info("Crawl date %s: %d events, took %.2f s".formatted(
                        date, totalEvents, (System.currentTimeMillis() - startTime) / 1000.0));
            }
        }));
    }

    private void crawlEvents(Page page, ArrayList<EventHtml> eventQueue) {
        final int scrollStep = 800;
        final int maxUnchanged = 5;
        int unchangedCount = 0;
        String previousKey = null;

        while (unchangedCount < maxUnchanged) {
            var doc = Jsoup.parse(page.content(), Constants.AI_SCORE_URL);
            var items = doc.select(".vue-recycle-scroller__item-view");
            if (items.isEmpty()) break;

            int addedThisRound = 0;

            for (var item : items) {
                var countryName = item.select(".country-name").text();
                var compeName = item.select(".compe-name").text();
                var leagueName = "%s %s".formatted(countryName, compeName);
                String logo = PlaywrightUtil.getImageFromStyleBackgroundImage(page, "i.country-logo.squareLogo");

                var matches = item.select("a.match-container");
                for (var m : matches) {
                    var event = new EventHtml(m)
                            .withCountryName(countryName.replace(":", ""))
                            .withLeagueName(leagueName)
                            .withLeagueUrl(logo);
                    if (event.getEventDate() == null) continue;
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
