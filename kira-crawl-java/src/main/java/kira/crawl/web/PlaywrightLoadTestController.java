package kira.crawl.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import kira.crawl.config.PlaywrightProperties;
import kira.crawl.dto.PlaywrightLoadTestResponse;
import kira.crawl.service.PlaywrightLoadTestService;
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
@RequestMapping("/test/playwright")
@RequiredArgsConstructor
@Tag(name = "test")
@ConditionalOnProperty(name = "app.playwright.test-api-enabled", havingValue = "true", matchIfMissing = true)
public class PlaywrightLoadTestController {

    private static final int LINK_COUNT = 5;

    private final PlaywrightLoadTestService loadTestService;
    private final PlaywrightProperties playwrightProperties;

    @GetMapping("/load")
    @Operation(summary = "Load 5 URLs in parallel with PlaywrightUtil (dev/test benchmark)")
    public WebAsyncTask<PlaywrightLoadTestResponse> loadFive(
            @RequestParam(required = false) String urls,
            @RequestParam(name = "timeout_ms", required = false) Long timeoutMs
    ) {
        var parsed = PlaywrightLoadTestService.parseUrlsParam(urls);
        final List<String> urlList = parsed.isEmpty()
                ? PlaywrightLoadTestService.defaultUrls()
                : parsed;

        try {
            PlaywrightLoadTestService.validateUrls(urlList);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage());
        }

        var asyncTimeoutMs = Math.min(
                300_000L,
                LINK_COUNT * playwrightProperties.browserTimeoutMs()
        );

        var task = new WebAsyncTask<>(asyncTimeoutMs, () -> loadTestService.loadFive(urlList, timeoutMs));
        task.onTimeout(() -> {
            throw new ResponseStatusException(HttpStatus.REQUEST_TIMEOUT, "Playwright load test timed out");
        });
        task.onError(() -> {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Playwright load test failed");
        });
        return task;
    }
}
