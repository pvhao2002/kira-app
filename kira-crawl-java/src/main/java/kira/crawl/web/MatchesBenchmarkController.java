package kira.crawl.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import kira.crawl.config.PlaywrightProperties;
import kira.crawl.dto.MatchesBenchmarkResponse;
import kira.crawl.service.MatchesBenchmarkService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.async.WebAsyncTask;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/test/matches")
@RequiredArgsConstructor
@Tag(name = "test")
@ConditionalOnProperty(name = "app.playwright.test-api-enabled", havingValue = "true", matchIfMissing = true)
public class MatchesBenchmarkController {

    private static final long ASYNC_TIMEOUT_BUFFER_MS = 30_000;

    private final MatchesBenchmarkService benchmarkService;
    private final PlaywrightProperties playwrightProperties;

    @GetMapping("/benchmark")
    @Operation(summary = "Benchmark 5 parallel GET /matches requests (E2E HTTP)")
    public WebAsyncTask<MatchesBenchmarkResponse> benchmark(
            @RequestParam(name = "base_url", required = false) String baseUrl,
            @RequestParam(required = false) String dates,
            @RequestParam(name = "timeout_ms", required = false) Long timeoutMs
    ) {
        var parsed = MatchesBenchmarkService.parseDatesParam(dates);
        final List<String> dateList = parsed.isEmpty()
                ? MatchesBenchmarkService.defaultDates()
                : parsed;

        try {
            MatchesBenchmarkService.validateDates(dateList);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage());
        }

        var asyncTimeoutMs = playwrightProperties.matchesAsyncTimeoutMs() + ASYNC_TIMEOUT_BUFFER_MS;

        var task = new WebAsyncTask<>(asyncTimeoutMs, () ->
                benchmarkService.runFive(baseUrl, dateList, timeoutMs)
        );
        task.onTimeout(() -> {
            throw new ResponseStatusException(HttpStatus.REQUEST_TIMEOUT, "Matches benchmark timed out");
        });
        task.onError(() -> {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Matches benchmark failed");
        });
        return task;
    }
}
