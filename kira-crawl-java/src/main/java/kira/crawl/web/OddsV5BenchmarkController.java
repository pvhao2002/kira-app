package kira.crawl.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import kira.crawl.config.PlaywrightProperties;
import kira.crawl.dto.OddsV4BenchmarkFixture;
import kira.crawl.dto.OddsV4BenchmarkResponse;
import kira.crawl.service.OddsV4BenchmarkService;
import kira.crawl.service.OddsV5BenchmarkService;
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
@RequestMapping("/test/matches/v5")
@RequiredArgsConstructor
@Tag(name = "test")
@ConditionalOnProperty(name = "app.playwright.test-api-enabled", havingValue = "true", matchIfMissing = true)
public class OddsV5BenchmarkController {

    private static final long ASYNC_TIMEOUT_BUFFER_MS = 30_000;

    private final OddsV5BenchmarkService benchmarkService;
    private final PlaywrightProperties playwrightProperties;

    @GetMapping("/benchmark")
    @Operation(summary = "Benchmark parallel getOddsV5 calls (direct service)")
    public WebAsyncTask<OddsV4BenchmarkResponse> benchmark(
            @RequestParam(required = false) String fixtures
    ) {
        var parsed = OddsV4BenchmarkService.parseFixturesParam(fixtures);
        final List<OddsV4BenchmarkFixture> fixtureList = parsed.isEmpty()
                ? OddsV4BenchmarkService.defaultFixtures()
                : parsed;

        try {
            OddsV4BenchmarkService.validateFixtures(fixtureList);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage());
        }

        var asyncTimeoutMs = (long) fixtureList.size() * playwrightProperties.oddsAsyncTimeoutMs()
                + ASYNC_TIMEOUT_BUFFER_MS;

        var task = new WebAsyncTask<>(asyncTimeoutMs, () -> benchmarkService.runParallel(fixtureList));
        task.onTimeout(() -> {
            throw new ResponseStatusException(HttpStatus.REQUEST_TIMEOUT, "Odds v5 benchmark timed out");
        });
        task.onError(() -> {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Odds v5 benchmark failed");
        });
        return task;
    }
}
