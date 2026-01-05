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

import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.BlockingQueue;
import java.util.logging.Level;

@Log
@Service
@RequiredArgsConstructor
public class CrawDateService {
    private static final String STATUS = "status";
    private static final String SQL_CRAWL_DATE = """
              update crawl_date
              set status = :status
              where date = :date
            """;
    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final BlockingQueue<EventHtml> eventQueue;

    public Object getAllEvents() {
        return eventQueue;
    }

    public void crawlDate(List<String> dates) {
        PlaywrightUtil.withPlaywright(dates, (page, mDates) -> mDates.forEach(date -> {
            var paramsDate = new MapSqlParameterSource("date", date);
            jdbcTemplate.update(SQL_CRAWL_DATE, paramsDate.addValue(STATUS, "in_progress"));
            try {
                page.navigate(Constants.AI_SCORE_URL + "%s".formatted(date));
                PlaywrightUtil.waitDomContentLoaded(page);
                var allBtn = page.locator("span.changeItem", new Page.LocatorOptions().setHasText("All"));
                allBtn.click();
                page.locator("span.sortByText", new Page.LocatorOptions().setHasText("Sort by time"))
                        .click();
                PlaywrightUtil.waitDomContentLoaded(page);
                crawlEvent(page, date);
            } catch (Exception ex) {
                log.log(Level.WARNING, "Error during analystDate", ex);
                jdbcTemplate.update(SQL_CRAWL_DATE, paramsDate.addValue(STATUS, "failed"));
            } finally {
                log.info("Crawl analystDate for date: " + date + " has %d events done at ".formatted(eventQueue.size()) + new Date());
            }
        }));
    }

    private void crawlEvent(Page page, String date) {
        final int scrollStep = 800;
        final int maxUnchanged = 5;
        int unchangedCount = 0;

        java.util.Set<String> seen = new java.util.HashSet<>(8096);

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

                    String href = m.attr("href");
                    String key = !href.isBlank()
                            ? href.trim()
                            : m.text().replaceAll("\\s+", " ").trim().toLowerCase() + "|" + leagueName.toLowerCase();

                    if (seen.add(key)) {
                        try {
                            eventQueue.put(event);
                            addedThisRound++;
                        } catch (InterruptedException ex) {
                            Thread.currentThread().interrupt();
                            return;
                        }
                    }
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
