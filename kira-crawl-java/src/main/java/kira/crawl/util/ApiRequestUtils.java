package kira.crawl.util;

import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

import java.util.Map;
import java.util.Objects;

public final class ApiRequestUtils {

    public static final int DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
    public static final int DEFAULT_READ_TIMEOUT_MS = 30_000;

    private ApiRequestUtils() {
    }

    public static ClientHttpRequestFactory requestFactory(int connectTimeoutMs, int readTimeoutMs) {
        var requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(connectTimeoutMs);
        requestFactory.setReadTimeout(readTimeoutMs);
        return requestFactory;
    }

    public static RestClient buildRestClient(String baseUrl) {
        return buildRestClient(baseUrl, DEFAULT_CONNECT_TIMEOUT_MS, DEFAULT_READ_TIMEOUT_MS);
    }

    public static RestClient buildRestClient(String baseUrl, int connectTimeoutMs, int readTimeoutMs) {
        var normalizedBaseUrl = Objects.requireNonNull(stripTrailingSlash(baseUrl), "baseUrl must not be null");
        return RestClient.builder()
                .baseUrl(normalizedBaseUrl)
                .requestFactory(requestFactory(connectTimeoutMs, readTimeoutMs))
                .build();
    }

    public static <T> T getForObject(RestClient client, String path, Class<T> responseType) {
        var restClient = Objects.requireNonNull(client, "client must not be null");
        var requestPath = Objects.requireNonNull(path, "path must not be null");
        var type = Objects.requireNonNull(responseType, "responseType must not be null");
        return restClient.get()
                .uri(requestPath)
                .retrieve()
                .body(type);
    }

    public static <T> T getForObject(
            RestClient client,
            String path,
            Map<String, ?> queryParams,
            Class<T> responseType
    ) {
        var restClient = Objects.requireNonNull(client, "client must not be null");
        var requestPath = Objects.requireNonNull(path, "path must not be null");
        var type = Objects.requireNonNull(responseType, "responseType must not be null");
        return restClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path(requestPath)
                        .queryParams(toMultiValueMap(queryParams))
                        .build())
                .retrieve()
                .body(type);
    }

    public static <T> T postForObject(RestClient client, String path, Object body, Class<T> responseType) {
        var restClient = Objects.requireNonNull(client, "client must not be null");
        var requestPath = Objects.requireNonNull(path, "path must not be null");
        var payload = Objects.requireNonNull(body, "body must not be null");
        var type = Objects.requireNonNull(responseType, "responseType must not be null");
        return restClient.post()
                .uri(requestPath)
                .body(payload)
                .retrieve()
                .body(type);
    }

    public static void postVoid(RestClient client, String path) {
        var restClient = Objects.requireNonNull(client, "client must not be null");
        var requestPath = Objects.requireNonNull(path, "path must not be null");
        restClient.post()
                .uri(requestPath)
                .retrieve()
                .toBodilessEntity();
    }

    public static void postVoid(RestClient client, String path, Object body) {
        var restClient = Objects.requireNonNull(client, "client must not be null");
        var requestPath = Objects.requireNonNull(path, "path must not be null");
        var payload = Objects.requireNonNull(body, "body must not be null");
        restClient.post()
                .uri(requestPath)
                .body(payload)
                .retrieve()
                .toBodilessEntity();
    }

    public static String stripTrailingSlash(String url) {
        if (url == null || url.isEmpty()) {
            return url;
        }
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }

    public static String joinPath(String baseUrl, String path) {
        var normalizedBase = stripTrailingSlash(baseUrl);
        if (path == null || path.isEmpty()) {
            return normalizedBase;
        }
        if (normalizedBase == null || normalizedBase.isEmpty()) {
            return path;
        }
        if (path.startsWith("/")) {
            return normalizedBase + path;
        }
        return normalizedBase + "/" + path;
    }

    private static MultiValueMap<String, String> toMultiValueMap(Map<String, ?> queryParams) {
        var values = new LinkedMultiValueMap<String, String>();
        if (queryParams == null || queryParams.isEmpty()) {
            return values;
        }
        queryParams.forEach((key, value) -> {
            if (key != null && value != null) {
                values.add(key, String.valueOf(value));
            }
        });
        return values;
    }
}
