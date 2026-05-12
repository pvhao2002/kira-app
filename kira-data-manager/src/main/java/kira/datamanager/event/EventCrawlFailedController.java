package kira.datamanager.event;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping
public class EventCrawlFailedController {

    private final EventCrawlFailedRepository eventCrawlFailedRepository;

    public EventCrawlFailedController(EventCrawlFailedRepository eventCrawlFailedRepository) {
        this.eventCrawlFailedRepository = eventCrawlFailedRepository;
    }

    @GetMapping("/event-crawl-failed")
    public ResponseEntity<?> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortDir
    ) {
        if (page < 0) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "page must be >= 0"));
        }
        if (size < 1 || size > 100) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "size must be between 1 and 100"));
        }
        if (sortBy != null && !sortBy.isBlank() && !EventCrawlFailedRepository.isAllowedSortBy(sortBy)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "status", "error",
                    "message", "sortBy must be one of: created_at, event_date"
            ));
        }
        if (sortDir != null && !sortDir.isBlank() && !EventCrawlFailedRepository.isAllowedSortDir(sortDir)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "status", "error",
                    "message", "sortDir must be one of: asc, desc"
            ));
        }

        var body = eventCrawlFailedRepository.findPage(page, size, sortBy, sortDir);
        return ResponseEntity.ok(body);
    }
}
