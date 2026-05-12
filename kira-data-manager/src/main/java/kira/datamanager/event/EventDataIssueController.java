package kira.datamanager.event;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping
public class EventDataIssueController {

    private final EventDataIssueRepository eventDataIssueRepository;

    public EventDataIssueController(EventDataIssueRepository eventDataIssueRepository) {
        this.eventDataIssueRepository = eventDataIssueRepository;
    }

    @GetMapping("/event-data-issues")
    public ResponseEntity<?> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortDir,
            @RequestParam(required = false) String issueType
    ) {
        if (page < 0) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "page must be >= 0"));
        }
        if (size < 1 || size > 100) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "size must be between 1 and 100"));
        }
        if (sortBy != null && !sortBy.isBlank() && !EventDataIssueRepository.isAllowedSortBy(sortBy)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "status", "error",
                    "message", "sortBy must be one of: recorded_at, event_date"
            ));
        }
        if (sortDir != null && !sortDir.isBlank() && !EventDataIssueRepository.isAllowedSortDir(sortDir)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "status", "error",
                    "message", "sortDir must be one of: asc, desc"
            ));
        }
        if (issueType != null && !issueType.isBlank() && !EventDataIssueRepository.isAllowedIssueType(issueType)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "status", "error",
                    "message", "issueType must be one of: missing_stats, missing_odds, cancelled"
            ));
        }

        var body = eventDataIssueRepository.findPage(page, size, sortBy, sortDir, issueType);
        return ResponseEntity.ok(body);
    }
}
