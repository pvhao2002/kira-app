package kira.crawl.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import kira.crawl.config.PlaywrightProperties;
import kira.crawl.service.AiscoreRawService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.async.WebAsyncTask;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/aiscore")
@RequiredArgsConstructor
@Tag(name = "aiscore-raw")
public class AiscoreRawController {

    private final AiscoreRawService aiscoreRawService;
    private final PlaywrightProperties playwrightProperties;

    @GetMapping("/raw")
    @Operation(summary = "Fetch AiScore API and return decoded protobuf JSON")
    public WebAsyncTask<Map<String, Object>> fetchRaw(
            @RequestParam String publicPageUrl,
            @RequestParam String apiUrl
    ) {
        var task = new WebAsyncTask<>(
                playwrightProperties.rawBrowserTimeoutMs(),
                () -> aiscoreRawService.fetchRaw(publicPageUrl, apiUrl)
        );
        task.onTimeout(() -> {
            throw new ResponseStatusException(HttpStatus.REQUEST_TIMEOUT, "AiScore raw request timed out");
        });
        task.onError(() -> {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AiScore raw request failed");
        });
        return task;
    }
}
