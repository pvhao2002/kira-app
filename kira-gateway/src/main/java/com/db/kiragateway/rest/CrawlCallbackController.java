package com.db.kiragateway.rest;

import com.db.kiragateway.dto.*;
import com.db.kiragateway.service.CrawlCallbackService;
import com.db.kiragateway.util.RequestLogUtil;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.logging.Logger;

@RestController
public class CrawlCallbackController {

    private static final Logger log = Logger.getLogger(CrawlCallbackController.class.getName());
    private final CrawlCallbackService service;

    public CrawlCallbackController(CrawlCallbackService service) {
        this.service = service;
    }

    @PutMapping("/crawl/dates/{date}/status")
    public ResponseEntity<?> updateCrawlDateStatus(@PathVariable String date,
                                                   @RequestBody CrawlDateStatusRequest req,
                                                   HttpServletRequest httpReq) {
        log.info("updateCrawlDateStatus: date=%s, status=%s, %s".formatted(date, req.status(), RequestLogUtil.summary(httpReq)));
        service.updateCrawlDateStatus(date, req);
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    @PostMapping("/crawl/events")
    public ResponseEntity<?> persistCrawledEvents(@RequestBody CrawlEventsRequest req,
                                                  HttpServletRequest httpReq) {
        int count = req.events() == null ? 0 : req.events().size();
        log.info("persistCrawledEvents: count=%d, %s".formatted(count, RequestLogUtil.summary(httpReq)));
        service.persistCrawledEvents(req.events());
        return ResponseEntity.ok(Map.of("status", "ok", "count", count));
    }

    @GetMapping("/events/{eventId}")
    public ResponseEntity<?> getEventInfo(@PathVariable long eventId,
                                          HttpServletRequest httpReq) {
        log.info("getEventInfo: eventId=%d, %s".formatted(eventId, RequestLogUtil.summary(httpReq)));
        return service.getEventInfo(eventId)
                .map(info -> ResponseEntity.ok(Map.of("status", "ok", "data", info)))
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PostMapping("/crawl/events/{eventId}/stats")
    public ResponseEntity<?> persistEventStats(@PathVariable long eventId,
                                               @RequestBody CrawlStatsRequest req,
                                               HttpServletRequest httpReq) {
        log.info("persistEventStats: eventId=%d, %s".formatted(eventId, RequestLogUtil.summary(httpReq)));
        service.persistEventStats(eventId, req);
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    @DeleteMapping("/crawl/events/{eventId}/odds")
    public ResponseEntity<?> deleteEventOdds(@PathVariable long eventId,
                                             HttpServletRequest httpReq) {
        log.info("deleteEventOdds: eventId=%d, %s".formatted(eventId, RequestLogUtil.summary(httpReq)));
        service.deleteEventOdds(eventId);
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    @PostMapping("/crawl/events/{eventId}/odds")
    public ResponseEntity<?> persistEventOdds(@PathVariable long eventId,
                                              @RequestBody CrawlOddsRequest req,
                                              HttpServletRequest httpReq) {
        log.info("persistEventOdds: eventId=%d, market=%s, %s".formatted(eventId, req.market(), RequestLogUtil.summary(httpReq)));
        service.persistEventOdds(eventId, req);
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    @PostMapping("/crawl/events/{eventId}/fail")
    public ResponseEntity<?> reportCrawlFail(@PathVariable long eventId,
                                             @RequestBody CrawlFailRequest req,
                                             HttpServletRequest httpReq) {
        log.info("reportCrawlFail: eventId=%d, type=%s, %s".formatted(eventId, req.type(), RequestLogUtil.summary(httpReq)));
        service.reportCrawlFail(eventId, req);
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    @DeleteMapping("/crawl/events/{eventId}/fail")
    public ResponseEntity<?> clearCrawlFail(@PathVariable long eventId,
                                            HttpServletRequest httpReq) {
        log.info("clearCrawlFail: eventId=%d, %s".formatted(eventId, RequestLogUtil.summary(httpReq)));
        service.clearCrawlFail(eventId);
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    @PostMapping("/crawl/events/{eventId}/no-odds")
    public ResponseEntity<?> recordEventNoOdds(@PathVariable long eventId,
                                               HttpServletRequest httpReq) {
        log.info("recordEventNoOdds: eventId=%d, %s".formatted(eventId, RequestLogUtil.summary(httpReq)));
        service.recordEventNoOdds(eventId);
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    @PostMapping("/crawl/events/{eventId}/missing-stats")
    public ResponseEntity<?> recordEventMissingStats(@PathVariable long eventId,
                                                     HttpServletRequest httpReq) {
        log.info("recordEventMissingStats: eventId=%d, %s".formatted(eventId, RequestLogUtil.summary(httpReq)));
        service.recordEventMissingStats(eventId);
        return ResponseEntity.ok(Map.of("status", "ok"));
    }
}
