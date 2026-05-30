package kira.datamanager.event;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping
public class EventClaimController {

    private static final Set<String> ALLOWED_STATUSES = Set.of("processing", "completed", "failed");
    private final EventClaimRepository eventClaimRepository;

    public EventClaimController(EventClaimRepository eventClaimRepository) {
        this.eventClaimRepository = eventClaimRepository;
    }

    @GetMapping("/event-claims")
    public ResponseEntity<?> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortDir,
            @RequestParam(required = false) String status
    ) {
        if (page < 0) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "page must be >= 0"));
        }
        if (size < 1 || size > 100) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "size must be between 1 and 100"));
        }
        if (sortBy != null && !sortBy.isBlank() && !EventClaimRepository.isAllowedSortBy(sortBy)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "status", "error",
                    "message", "sortBy must be one of: claimed_at, event_date"
            ));
        }
        if (sortDir != null && !sortDir.isBlank() && !EventClaimRepository.isAllowedSortDir(sortDir)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "status", "error",
                    "message", "sortDir must be one of: asc, desc"
            ));
        }
        if (status != null && !status.isBlank() && !ALLOWED_STATUSES.contains(status.trim().toLowerCase())) {
            return ResponseEntity.badRequest().body(Map.of(
                    "status", "error",
                    "message", "status must be one of: processing, completed, failed"
            ));
        }

        var body = eventClaimRepository.findPage(page, size, sortBy, sortDir, status);
        return ResponseEntity.ok(body);
    }
}
