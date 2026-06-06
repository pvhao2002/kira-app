package kira.producer.rest;

import kira.producer.amqp.DateProducer;
import kira.producer.util.DateUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.amqp.AmqpException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Log
@RestController
@RequestMapping("/producer/crawl-dates")
@RequiredArgsConstructor
public class CrawlDateController {

    private final DateProducer dateProducer;

    @PostMapping("/{date}/requeue")
    public ResponseEntity<?> requeueDate(@PathVariable String date) {
        final String crawlDate;
        try {
            crawlDate = DateUtil.toCrawlDateFormat(date);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", ex.getMessage()));
        }

        try {
            dateProducer.sendDate(crawlDate);
        } catch (AmqpException ex) {
            log.warning("Failed to publish requeue date " + crawlDate + ": " + ex.getMessage());
            return ResponseEntity.status(502).body(Map.of("status", "error", "message", "failed to enqueue date"));
        }

        return ResponseEntity.ok(Map.of("status", "ok", "date", crawlDate));
    }

    @PostMapping("/requeue-range")
    public ResponseEntity<?> requeueDateRange(
            @RequestParam String fromDate,
            @RequestParam String toDate
    ) {
        final LocalDate start;
        final LocalDate end;
        try {
            start = DateUtil.parseCrawlInputDate(fromDate);
            end = DateUtil.parseCrawlInputDate(toDate);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", ex.getMessage()));
        }
        if (start.isAfter(end)) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "fromDate must be on or before toDate"));
        }

        var enqueued = new ArrayList<String>();
        var failed = new ArrayList<String>();
        for (LocalDate current = start; !current.isAfter(end); current = current.plusDays(1)) {
            String crawlDate = DateUtil.formatCrawlDate(current);
            try {
                dateProducer.sendDate(crawlDate);
                enqueued.add(crawlDate);
            } catch (AmqpException ex) {
                log.warning("Failed to publish requeue date " + crawlDate + ": " + ex.getMessage());
                failed.add(crawlDate);
            }
        }

        if (enqueued.isEmpty()) {
            return ResponseEntity.status(502).body(Map.of(
                    "status", "error",
                    "message", "failed to enqueue any date",
                    "fromDate", DateUtil.toCrawlDateFormat(fromDate),
                    "toDate", DateUtil.toCrawlDateFormat(toDate),
                    "failed", failed
            ));
        }

        int totalDays = (int) ChronoUnit.DAYS.between(start, end) + 1;
        var body = new LinkedHashMap<String, Object>();
        body.put("status", failed.isEmpty() ? "ok" : "partial");
        body.put("fromDate", DateUtil.formatCrawlDate(start));
        body.put("toDate", DateUtil.formatCrawlDate(end));
        body.put("total", totalDays);
        body.put("enqueued", enqueued.size());
        body.put("dates", List.copyOf(enqueued));
        if (!failed.isEmpty()) {
            body.put("failed", List.copyOf(failed));
        }
        return ResponseEntity.ok(body);
    }
}
