package kira.crawl.browser;

import com.google.gson.JsonObject;
import com.microsoft.playwright.CDPSession;
import com.microsoft.playwright.Page;
import kira.crawl.service.AiscoreBadGatewayException;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

public final class CdpNetworkCapture implements AutoCloseable {

    private final CDPSession session;
    private final Map<String, CompletableFuture<byte[]>> pendingBodies = new ConcurrentHashMap<>();
    private final Map<String, String> matchedRequests = new ConcurrentHashMap<>();
    private final ScheduledExecutorService timers = Executors.newSingleThreadScheduledExecutor();
    private final Consumer<JsonObject> responseReceivedHandler;
    private final Consumer<JsonObject> loadingFinishedHandler;
    private final Consumer<JsonObject> loadingFailedHandler;

    private CdpNetworkCapture(Page page, List<String> apiUrls, long timeoutMs) {
        this.session = page.context().newCDPSession(page);
        this.session.send("Network.enable");

        for (var apiUrl : apiUrls) {
            var future = new CompletableFuture<byte[]>();
            pendingBodies.put(apiUrl, future);
            timers.schedule(() -> future.completeExceptionally(new AiscoreBadGatewayException(
                    "AiScore API response was not found in page network traffic",
                    Map.of("apiUrl", apiUrl)
            )), timeoutMs, TimeUnit.MILLISECONDS);
        }

        this.responseReceivedHandler = event -> onResponseReceived(event, apiUrls);
        this.loadingFinishedHandler = this::onLoadingFinished;
        this.loadingFailedHandler = this::onLoadingFailed;

        session.on("Network.responseReceived", responseReceivedHandler);
        session.on("Network.loadingFinished", loadingFinishedHandler);
        session.on("Network.loadingFailed", loadingFailedHandler);
    }

    public static CdpNetworkCapture start(Page page, List<String> apiUrls, long timeoutMs) {
        return new CdpNetworkCapture(page, apiUrls, timeoutMs);
    }

    public Map<String, CompletableFuture<byte[]>> futures() {
        return pendingBodies;
    }

    public byte[] awaitBody(String apiUrl) {
        try {
            return pendingBodies.get(apiUrl).join();
        } catch (Exception ex) {
            if (ex.getCause() instanceof AiscoreBadGatewayException badGateway) {
                throw badGateway;
            }
            throw new AiscoreBadGatewayException(
                    "AiScore API response was not found in page network traffic",
                    Map.of("apiUrl", apiUrl)
            );
        }
    }

    public List<byte[]> awaitAll(List<String> apiUrls) {
        return apiUrls.stream().map(this::awaitBody).toList();
    }

    private void onResponseReceived(JsonObject event, List<String> apiUrls) {
        if (!event.has("response")) {
            return;
        }
        var response = event.getAsJsonObject("response");
        var actualUrl = response.get("url").getAsString();
        var apiUrl = apiUrls.stream()
                .filter(expected -> ApiUrlMatcher.isSameApiRequest(actualUrl, expected))
                .findFirst()
                .orElse(null);
        if (apiUrl == null || !pendingBodies.containsKey(apiUrl)) {
            return;
        }

        var status = response.get("status").getAsInt();
        if (status < 200 || status >= 300) {
            pendingBodies.get(apiUrl).completeExceptionally(new AiscoreBadGatewayException(
                    "AiScore API response from network was not successful",
                    Map.of("apiUrl", apiUrl, "status", status)
            ));
            pendingBodies.remove(apiUrl);
            return;
        }

        matchedRequests.put(event.get("requestId").getAsString(), apiUrl);
    }

    private void onLoadingFinished(JsonObject event) {
        var requestId = event.get("requestId").getAsString();
        var apiUrl = matchedRequests.get(requestId);
        if (apiUrl == null) {
            return;
        }

        try {
            var params = new JsonObject();
            params.addProperty("requestId", requestId);
            var bodyResult = session.send("Network.getResponseBody", params);
            var body = bodyResult.get("body").getAsString();
            var base64 = bodyResult.get("base64Encoded").getAsBoolean();
            var bytes = base64
                    ? Base64.getDecoder().decode(body)
                    : body.getBytes(StandardCharsets.UTF_8);
            pendingBodies.get(apiUrl).complete(bytes);
        } catch (Exception ex) {
            pendingBodies.get(apiUrl).completeExceptionally(ex);
        } finally {
            pendingBodies.remove(apiUrl);
            matchedRequests.remove(requestId);
        }
    }

    private void onLoadingFailed(JsonObject event) {
        var requestId = event.get("requestId").getAsString();
        var apiUrl = matchedRequests.get(requestId);
        if (apiUrl == null) {
            return;
        }

        var errorText = event.has("errorText") ? event.get("errorText").getAsString() : "unknown";
        pendingBodies.get(apiUrl).completeExceptionally(new AiscoreBadGatewayException(
                "AiScore API network request failed",
                Map.of("apiUrl", apiUrl, "error", errorText)
        ));
        pendingBodies.remove(apiUrl);
        matchedRequests.remove(requestId);
    }

    @Override
    public void close() {
        timers.shutdownNow();
        try {
            session.off("Network.responseReceived", responseReceivedHandler);
            session.off("Network.loadingFinished", loadingFinishedHandler);
            session.off("Network.loadingFailed", loadingFailedHandler);
        } catch (RuntimeException ignored) {
            // Playwright may throw if session already closed.
        }
        try {
            session.detach();
        } catch (RuntimeException ignored) {
            // Ignore detach failures during cleanup.
        }
        for (var future : pendingBodies.values()) {
            future.cancel(true);
        }
        pendingBodies.clear();
        matchedRequests.clear();
    }

    public static final class ApiUrlMatcher {

        private ApiUrlMatcher() {
        }

        public static boolean isSameApiRequest(String actualUrl, String expectedUrl) {
            try {
                var actual = java.net.URI.create(actualUrl);
                var expected = java.net.URI.create(expectedUrl);
                if (!sameOrigin(actual, expected) || !samePath(actual, expected)) {
                    return false;
                }
                var actualQuery = parseQuery(actual.getRawQuery());
                var expectedQuery = parseQuery(expected.getRawQuery());
                for (var entry : expectedQuery.entrySet()) {
                    if (!entry.getValue().equals(actualQuery.get(entry.getKey()))) {
                        return false;
                    }
                }
                return true;
            } catch (IllegalArgumentException ex) {
                return false;
            }
        }

        private static boolean sameOrigin(java.net.URI actual, java.net.URI expected) {
            return actual.getScheme().equals(expected.getScheme())
                    && actual.getHost().equals(expected.getHost());
        }

        private static boolean samePath(java.net.URI actual, java.net.URI expected) {
            var actualPath = actual.getPath() == null ? "" : actual.getPath();
            var expectedPath = expected.getPath() == null ? "" : expected.getPath();
            return actualPath.equals(expectedPath);
        }

        private static Map<String, String> parseQuery(String rawQuery) {
            var result = new LinkedHashMap<String, String>();
            if (rawQuery == null || rawQuery.isBlank()) {
                return result;
            }
            for (var pair : rawQuery.split("&")) {
                var idx = pair.indexOf('=');
                if (idx <= 0) {
                    continue;
                }
                result.put(
                        java.net.URLDecoder.decode(pair.substring(0, idx), StandardCharsets.UTF_8),
                        java.net.URLDecoder.decode(pair.substring(idx + 1), StandardCharsets.UTF_8)
                );
            }
            return result;
        }
    }
}
