package kira.crawl.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import kira.crawl.config.PlaywrightProperties;
import kira.crawl.service.MatchesService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.async.WebAsyncTask;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/matches")
@RequiredArgsConstructor
@Tag(name = "matches")
public class MatchesController {

    private final MatchesService matchesService;
    private final PlaywrightProperties playwrightProperties;

    @GetMapping
    @Operation(summary = "List matches for a given date")
    public WebAsyncTask<Object> findMatches(
            @RequestParam(required = false) String date,
            @RequestParam(name = "sport_id", required = false) String sportId,
            @RequestParam(required = false) String lang,
            @RequestParam(required = false) String tz,
            @RequestParam(name = "match_id", required = false) String matchId,
            @RequestParam(required = false) String raw
    ) {
        return crawlTask(playwrightProperties.matchesAsyncTimeoutMs(),
                () -> matchesService.findMatches(new MatchesService.MatchQuery(date, sportId, lang, tz, matchId, raw)));
    }

    @GetMapping("/odds")
    @Operation(summary = "Crawl odds for a single match")
    public WebAsyncTask<Object> findMatchOdds(@RequestParam(name = "event_link") String eventLink) {
        return crawlTask(playwrightProperties.oddsAsyncTimeoutMs(), () -> matchesService.findMatchOdds(eventLink));
    }

    private WebAsyncTask<Object> crawlTask(long asyncTimeoutMs, ThrowingSupplier supplier) {
        var task = new WebAsyncTask<>(asyncTimeoutMs, supplier::get);
        task.onTimeout(() -> {
            throw new ResponseStatusException(HttpStatus.REQUEST_TIMEOUT, "AiScore crawl request timed out");
        });
        task.onError(() -> {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AiScore crawl request failed");
        });
        return task;
    }

    @FunctionalInterface
    private interface ThrowingSupplier {
        Object get();
    }
}
