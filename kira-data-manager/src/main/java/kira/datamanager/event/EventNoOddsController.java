package kira.datamanager.event;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping
public class EventNoOddsController {

    private final EventNoOddsRepository eventNoOddsRepository;

    public EventNoOddsController(EventNoOddsRepository eventNoOddsRepository) {
        this.eventNoOddsRepository = eventNoOddsRepository;
    }

    @GetMapping("/event-no-odds")
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
        if (sortBy != null && !sortBy.isBlank() && !EventNoOddsRepository.isAllowedSortBy(sortBy)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "status", "error",
                    "message", "sortBy must be one of: recorded_at, event_date"
            ));
        }
        if (sortDir != null && !sortDir.isBlank() && !EventNoOddsRepository.isAllowedSortDir(sortDir)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "status", "error",
                    "message", "sortDir must be one of: asc, desc"
            ));
        }

        var body = eventNoOddsRepository.findPage(page, size, sortBy, sortDir);
        return ResponseEntity.ok(body);
    }
}
