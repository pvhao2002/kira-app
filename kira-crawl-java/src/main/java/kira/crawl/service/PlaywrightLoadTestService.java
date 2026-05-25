package kira.crawl.service;

import com.microsoft.playwright.Page;
import kira.crawl.browser.CloudflareSupport;
import kira.crawl.config.PlaywrightProperties;
import kira.crawl.dto.PlaywrightLoadTestLinkResult;
import kira.crawl.dto.PlaywrightLoadTestResponse;
import kira.crawl.util.PlaywrightUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Stream;

/**
 * Parallel load test: one Playwright instance per platform thread (Playwright Java multithreading docs).
 * Does not use the shared singleton driver pool.
 */
@Service
@RequiredArgsConstructor
public class PlaywrightLoadTestService {

    static final String EXECUTION_MODE_PER_THREAD = "perThreadPlaywright";

    private static final int LINK_COUNT = 5;

    private static final List<String> DEFAULT_URLS = List.of(
            "https://www.aiscore.com/20180101",
            "https://www.aiscore.com/20180102",
            "https://www.aiscore.com/20180103",
            "https://www.aiscore.com/20180104",
            "https://www.aiscore.com/20180105"
    );

    private final PlaywrightProperties playwrightProperties;

    public PlaywrightLoadTestResponse loadFive(List<String> urls, Long timeoutMsOverride) {
        var urlsToLoad = urls == null || urls.isEmpty() ? DEFAULT_URLS : urls;
        validateUrls(urlsToLoad);

        var timeoutMs = timeoutMsOverride != null && timeoutMsOverride > 0
                ? timeoutMsOverride
                : playwrightProperties.browserTimeoutMs();

        var headless = !PlaywrightUtil.isRunningProd();
        var totalStart = System.nanoTime();
        var results = new ArrayList<PlaywrightLoadTestLinkResult>(LINK_COUNT);

        try (ExecutorService executor = Executors.newFixedThreadPool(LINK_COUNT, r -> {
            var thread = new Thread(r, "playwright-load-test");
            thread.setDaemon(true);
            return thread;
        })) {
            var futures = new ArrayList<CompletableFuture<PlaywrightLoadTestLinkResult>>();
            for (int i = 0; i < LINK_COUNT; i++) {
                var index = i;
                var url = urlsToLoad.get(i);
                futures.add(CompletableFuture.supplyAsync(
                        () -> loadOneOnDedicatedThread(index, url, timeoutMs, headless),
                        executor
                ));
            }
            CompletableFuture.allOf(futures.toArray(CompletableFuture[]::new)).join();
            for (var future : futures) {
                results.add(future.join());
            }
        }

        results.sort(Comparator.comparingInt(PlaywrightLoadTestLinkResult::index));
        var totalDurationMs = (System.nanoTime() - totalStart) / 1_000_000;

        return new PlaywrightLoadTestResponse(
                totalDurationMs,
                true,
                EXECUTION_MODE_PER_THREAD,
                PlaywrightUtil.contextPoolSize(),
                List.copyOf(results)
        );
    }

    private static PlaywrightLoadTestLinkResult loadOneOnDedicatedThread(int index, String url, long timeoutMs, boolean headless) {
        return PlaywrightUtil.runIsolated(headless, page -> loadOne(index, url, page, timeoutMs));
    }

    public static List<String> defaultUrls() {
        return DEFAULT_URLS;
    }

    public static void validateUrls(List<String> urls) {
        if (urls.size() != LINK_COUNT) {
            throw new IllegalArgumentException("Exactly " + LINK_COUNT + " URLs are required, got " + urls.size());
        }
        for (var url : urls) {
            validateAiscoreUrl(url);
        }
    }

    public static List<String> parseUrlsParam(String urlsParam) {
        if (urlsParam == null || urlsParam.isBlank()) {
            return List.of();
        }
        return Stream.of(urlsParam.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .toList();
    }

    private static PlaywrightLoadTestLinkResult loadOne(int index, String url, Page page, long timeoutMs) {
        var start = System.nanoTime();
        try {
            PlaywrightUtil.navigateForApiCapture(page, url, timeoutMs);
            CloudflareSupport.waitForClearance(page, timeoutMs);
            return new PlaywrightLoadTestLinkResult(
                    index,
                    url,
                    (System.nanoTime() - start) / 1_000_000,
                    safeTitle(page),
                    page.url(),
                    true,
                    null
            );
        } catch (Exception ex) {
            return new PlaywrightLoadTestLinkResult(
                    index,
                    url,
                    (System.nanoTime() - start) / 1_000_000,
                    safeTitle(page),
                    safeUrl(page),
                    false,
                    ex.getMessage()
            );
        }
    }

    private static String safeTitle(Page page) {
        try {
            return page.title();
        } catch (Exception ex) {
            return null;
        }
    }

    private static String safeUrl(Page page) {
        try {
            return page.url();
        } catch (Exception ex) {
            return null;
        }
    }

    private static void validateAiscoreUrl(String rawUrl) {
        URI url;
        try {
            url = URI.create(rawUrl);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Invalid URL: \"" + rawUrl + "\"");
        }
        if (!"https".equalsIgnoreCase(url.getScheme())) {
            throw new IllegalArgumentException("URL must use https: \"" + rawUrl + "\"");
        }
        var host = url.getHost();
        if (!"aiscore.com".equals(host) && !"www.aiscore.com".equals(host)) {
            throw new IllegalArgumentException(
                    "URL host must be aiscore.com or www.aiscore.com, got \"" + host + "\""
            );
        }
    }
}
