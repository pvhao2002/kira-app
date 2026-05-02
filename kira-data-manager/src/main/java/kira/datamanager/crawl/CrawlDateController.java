package kira.datamanager.crawl;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping
public class CrawlDateController {

    private final CrawlDateRepository crawlDateRepository;

    public CrawlDateController(CrawlDateRepository crawlDateRepository) {
        this.crawlDateRepository = crawlDateRepository;
    }

    @GetMapping("/crawl-dates")
    public ResponseEntity<?> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String date,
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortDir
    ) {
        if (page < 0) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "page must be >= 0"));
        }
        if (size < 1 || size > 100) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "size must be between 1 and 100"));
        }
        if (status != null && !status.isBlank() && !CrawlDateRepository.isAllowedStatus(status)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "status", "error",
                    "message", "status must be one of: pending, picked, in_progress, done, failed"
            ));
        }
        if (sortBy != null && !sortBy.isBlank() && !CrawlDateRepository.isAllowedSortBy(sortBy)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "status", "error",
                    "message", "sortBy must be one of: date, total_events"
            ));
        }
        if (sortDir != null && !sortDir.isBlank() && !CrawlDateRepository.isAllowedSortDir(sortDir)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "status", "error",
                    "message", "sortDir must be one of: asc, desc"
            ));
        }

        var body = crawlDateRepository.findPage(page, size, status, date, dateFrom, dateTo, sortBy, sortDir);
        return ResponseEntity.ok(body);
    }
}
