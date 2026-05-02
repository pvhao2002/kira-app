package kira.datamanager.event;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping
public class EventCancelledController {

    private final EventCancelledRepository eventCancelledRepository;

    public EventCancelledController(EventCancelledRepository eventCancelledRepository) {
        this.eventCancelledRepository = eventCancelledRepository;
    }

    @GetMapping("/event-cancelled")
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
        if (sortBy != null && !sortBy.isBlank() && !EventCancelledRepository.isAllowedSortBy(sortBy)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "status", "error",
                    "message", "sortBy must be one of: event_date, created_at"
            ));
        }
        if (sortDir != null && !sortDir.isBlank() && !EventCancelledRepository.isAllowedSortDir(sortDir)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "status", "error",
                    "message", "sortDir must be one of: asc, desc"
            ));
        }

        var body = eventCancelledRepository.findPage(page, size, sortBy, sortDir);
        return ResponseEntity.ok(body);
    }
}
