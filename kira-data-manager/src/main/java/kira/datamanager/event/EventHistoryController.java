package kira.datamanager.event;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Events history API under servlet context {@code /data}.
 * <p>
 * GET /data/events/history?date=YYYY-MM-DD[&q=...][&league=...][&page=0][&size=10]
 */
@RestController
@RequestMapping
public class EventHistoryController {

    private final EventHistoryRepository eventHistoryRepository;

    public EventHistoryController(EventHistoryRepository eventHistoryRepository) {
        this.eventHistoryRepository = eventHistoryRepository;
    }

    @GetMapping("/events/history")
    public ResponseEntity<?> list(
            @RequestParam String date,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String league,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        if (date == null || date.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "date is required (YYYY-MM-DD)"));
        }
        if (page < 0) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "page must be >= 0"));
        }
        if (size < 1 || size > 50) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "size must be between 1 and 50"));
        }

        var body = eventHistoryRepository.findPage(date, q, league, page, size);
        return ResponseEntity.ok(body);
    }

    /**
     * GET /data/events/history/{eventId}/odds-timeline
     * Returns the full odds timeline from event_odds_timeline for the given event.
     */
    @GetMapping("/events/history/{eventId}/odds-timeline")
    public ResponseEntity<?> oddsTimeline(@PathVariable long eventId) {
        if (eventId <= 0) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "eventId must be > 0"));
        }
        var rows = eventHistoryRepository.findOddsTimeline(eventId);
        return ResponseEntity.ok(Map.of("data", rows));
    }
}
