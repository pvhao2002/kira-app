package kira.datamanager.team;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** Team APIs under servlet context {@code /data}. */
@RestController
@RequestMapping
public class TeamController {

    private final TeamRepository teamRepository;

    public TeamController(TeamRepository teamRepository) {
        this.teamRepository = teamRepository;
    }

    @GetMapping("/teams")
    public ResponseEntity<?> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String q
    ) {
        if (page < 0) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "page must be >= 0"));
        }
        if (size < 1 || size > 100) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "size must be between 1 and 100"));
        }

        var body = teamRepository.findPage(page, size, q);
        return ResponseEntity.ok(body);
    }

    @GetMapping("/teams/suggestions/names")
    public ResponseEntity<?> suggestNames(
            @RequestParam String q,
            @RequestParam(defaultValue = "15") int limit
    ) {
        var qTrim = q != null ? q.trim() : "";
        if (qTrim.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "q is required"));
        }
        if (limit < 1 || limit > 50) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "limit must be between 1 and 50"));
        }
        List<String> suggestions = teamRepository.suggestTeamNames(qTrim, limit);
        return ResponseEntity.ok(Map.of("suggestions", suggestions));
    }
}
