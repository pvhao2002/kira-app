package kira.crawl.service;

import kira.crawl.config.PlaywrightProperties;
import kira.crawl.dto.MatchesBenchmarkLinkResult;
import kira.crawl.dto.MatchesBenchmarkResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/**
 * E2E benchmark: 5 parallel HTTP GETs to {@code /matches} (default dates 20260101–20260105).
 */
@Service
@RequiredArgsConstructor
public class MatchesBenchmarkService {

    private static final int DATE_COUNT = 5;
    private static final Pattern DATE_PATTERN = Pattern.compile("^\\d{8}$");

    private static final List<String> DEFAULT_DATES = List.of(
            "20260101",
            "20260102",
            "20260103",
            "20260104",
            "20260105"
    );

    private final PlaywrightProperties playwrightProperties;

    public MatchesBenchmarkResponse runFive(String baseUrlOverride, List<String> dates, Long timeoutMsOverride) {
        var datesToRun = dates == null || dates.isEmpty() ? DEFAULT_DATES : dates;
        validateDates(datesToRun);

        var baseUrl = resolveBaseUrl(baseUrlOverride);
        var timeoutMs = timeoutMsOverride != null && timeoutMsOverride > 0
                ? timeoutMsOverride
                : playwrightProperties.matchesAsyncTimeoutMs();

        var httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(Math.min(timeoutMs, 30_000)))
                .build();

        var totalStart = System.nanoTime();
        var results = new ArrayList<MatchesBenchmarkLinkResult>(DATE_COUNT);

        try (ExecutorService executor = Executors.newFixedThreadPool(DATE_COUNT, r -> {
            var thread = new Thread(r, "matches-benchmark");
            thread.setDaemon(true);
            return thread;
        })) {
            var futures = new ArrayList<CompletableFuture<MatchesBenchmarkLinkResult>>();
            for (int i = 0; i < DATE_COUNT; i++) {
                var index = i;
                var date = datesToRun.get(i);
                var requestUrl = buildMatchesUrl(baseUrl, date);
                futures.add(CompletableFuture.supplyAsync(
                        () -> fetchOne(httpClient, index, date, requestUrl, timeoutMs),
                        executor
                ));
            }
            CompletableFuture.allOf(futures.toArray(CompletableFuture[]::new)).join();
            for (var future : futures) {
                results.add(future.join());
            }
        }

        results.sort(Comparator.comparingInt(MatchesBenchmarkLinkResult::index));
        var totalDurationMs = (System.nanoTime() - totalStart) / 1_000_000;

        return new MatchesBenchmarkResponse(
                totalDurationMs,
                true,
                baseUrl,
                List.copyOf(results)
        );
    }

    public String resolveBaseUrl(String baseUrlOverride) {
        if (baseUrlOverride != null && !baseUrlOverride.isBlank()) {
            return stripTrailingSlash(baseUrlOverride.trim());
        }
        var configured = playwrightProperties.matchesBenchmarkBaseUrl();
        if (configured != null && !configured.isBlank()) {
            return stripTrailingSlash(configured.trim());
        }
        return "http://localhost:" + playwrightProperties.serverPort();
    }

    public static String buildMatchesUrl(String baseUrl, String date) {
        return stripTrailingSlash(baseUrl)
                + "/matches?raw=false&tz=07%3A00&lang=2&sport_id=1&date="
                + date;
    }

    public static List<String> defaultDates() {
        return DEFAULT_DATES;
    }

    public static void validateDates(List<String> dates) {
        if (dates.size() != DATE_COUNT) {
            throw new IllegalArgumentException("Exactly " + DATE_COUNT + " dates are required, got " + dates.size());
        }
        for (var date : dates) {
            if (date == null || !DATE_PATTERN.matcher(date).matches()) {
                throw new IllegalArgumentException("Date must be yyyyMMdd (8 digits), got \"" + date + "\"");
            }
        }
    }

    public static List<String> parseDatesParam(String datesParam) {
        if (datesParam == null || datesParam.isBlank()) {
            return List.of();
        }
        return Stream.of(datesParam.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .toList();
    }

    private static MatchesBenchmarkLinkResult fetchOne(
            HttpClient httpClient,
            int index,
            String date,
            String requestUrl,
            long timeoutMs
    ) {
        var start = System.nanoTime();
        try {
            var request = HttpRequest.newBuilder()
                    .uri(URI.create(requestUrl))
                    .GET()
                    .timeout(Duration.ofMillis(timeoutMs))
                    .build();
            var response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
            var status = response.statusCode();
            var bodyBytes = response.body() == null ? 0L : response.body().length;
            var ok = status >= 200 && status < 300;
            return new MatchesBenchmarkLinkResult(
                    index,
                    date,
                    requestUrl,
                    (System.nanoTime() - start) / 1_000_000,
                    status,
                    bodyBytes,
                    ok,
                    ok ? null : "HTTP " + status
            );
        } catch (Exception ex) {
            return new MatchesBenchmarkLinkResult(
                    index,
                    date,
                    requestUrl,
                    (System.nanoTime() - start) / 1_000_000,
                    0,
                    0,
                    false,
                    ex.getMessage()
            );
        }
    }

    private static String stripTrailingSlash(String url) {
        if (url.endsWith("/")) {
            return url.substring(0, url.length() - 1);
        }
        return url;
    }
}
