package kira.datamanager.league;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** League APIs under servlet context {@code /data} — web UI calls these URLs directly (not via kira-gateway). */
@RestController
@RequestMapping
public class LeagueController {

    private final LeagueRepository leagueRepository;

    public LeagueController(LeagueRepository leagueRepository) {
        this.leagueRepository = leagueRepository;
    }

    @GetMapping("/leagues")
    public ResponseEntity<?> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Boolean isMain,
            @RequestParam(required = false) String country
    ) {
        if (page < 0) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "page must be >= 0"));
        }
        if (size < 1 || size > 100) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "size must be between 1 and 100"));
        }

        var body = leagueRepository.findPage(page, size, q, isMain, country);
        return ResponseEntity.ok(body);
    }

    @GetMapping("/leagues/suggestions/names")
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
        List<String> suggestions = leagueRepository.suggestLeagueNames(qTrim, limit);
        return ResponseEntity.ok(Map.of("suggestions", suggestions));
    }

    @GetMapping("/leagues/suggestions/countries")
    public ResponseEntity<?> suggestCountries(
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
        List<String> suggestions = leagueRepository.suggestCountries(qTrim, limit);
        return ResponseEntity.ok(Map.of("suggestions", suggestions));
    }

    @PatchMapping("/leagues/{leagueId}/main")
    public ResponseEntity<?> updateMain(
            @PathVariable int leagueId,
            @RequestBody LeagueMainUpdateRequest body
    ) {
        int n = leagueRepository.updateMain(leagueId, body.isMain());
        if (n == 0) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                    "status", "error",
                    "message", "League not found"
            ));
        }
        return ResponseEntity.ok(Map.of(
                "status", "success",
                "leagueId", leagueId,
                "isMain", body.isMain()
        ));
    }
}
