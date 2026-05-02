package kira.producer.rest;

import kira.producer.amqp.DateProducer;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.amqp.AmqpException;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.regex.Pattern;

@Log
@RestController
@RequestMapping("/producer/crawl-dates")
@RequiredArgsConstructor
public class CrawlDateController {
    private static final Pattern ISO_DATE = Pattern.compile("\\d{4}-\\d{2}-\\d{2}");

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final DateProducer dateProducer;

    @PostMapping("/{date}/requeue")
    public ResponseEntity<?> requeueDate(@PathVariable String date) {
        String d = date == null ? "" : date.trim();
        if (!ISO_DATE.matcher(d).matches()) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "date must be yyyy-MM-dd"));
        }

        Long count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM crawl_date WHERE date = :date",
                Map.of("date", d),
                Long.class
        );
        if (count == null || count == 0L) {
            return ResponseEntity.status(404).body(Map.of("status", "error", "message", "crawl_date not found for date: " + d));
        }

        try {
            dateProducer.sendDate(d);
        } catch (AmqpException ex) {
            log.warning("Failed to publish requeue date " + d + ": " + ex.getMessage());
            return ResponseEntity.status(502).body(Map.of("status", "error", "message", "failed to enqueue date"));
        }

        jdbcTemplate.update(
                "UPDATE crawl_date SET status = 'picked' WHERE date = :date",
                Map.of("date", d)
        );
        return ResponseEntity.ok(Map.of("status", "ok", "date", d));
    }
}
