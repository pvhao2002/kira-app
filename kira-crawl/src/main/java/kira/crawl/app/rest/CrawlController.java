package kira.crawl.app.rest;

import kira.crawl.app.service.CrawlDateService;
import kira.crawl.app.service.CrawlEventService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@RestController
@RequiredArgsConstructor
public class CrawlController {

    private final CrawlDateService crawlDateService;
    private final CrawlEventService crawlEventService;

    @GetMapping("/dates")
    public ResponseEntity<?> crawlDates(@RequestParam("d") String dates) {
        var dateList = Arrays.stream(dates.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .toList();
        if (dateList.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "dates param is required"));
        }
        CompletableFuture.runAsync(() -> crawlDateService.crawlDate(dateList));
        return ResponseEntity.ok(Map.of("status", "ok", "message", "crawl started for dates: " + dateList));
    }

    @GetMapping("/events")
    public ResponseEntity<?> crawlEvent(@RequestParam("e") long eventId) {
        CompletableFuture.runAsync(() -> crawlEventService.processEvent(eventId));
        return ResponseEntity.ok(Map.of("status", "ok", "message", "crawl started for eventId: " + eventId));
    }
}
