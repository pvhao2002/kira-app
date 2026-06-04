package com.queue.kiraqueue.browser;

import com.microsoft.playwright.Page;
import com.queue.kiraqueue.config.AiscoreBadGatewayException;
import com.queue.kiraqueue.config.PlaywrightProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.stereotype.Component;

import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.logging.Level;

/**
 * Fetches AiScore protobuf APIs via in-page {@code fetch()} (console evaluate).
 */
@Component
@RequiredArgsConstructor
@Log
public class AiscorePageFetchClient {

    public static final String ORIGIN = "https://www.aiscore.com";

    private static final String PARALLEL_FETCH_SCRIPT = """
            async ({ entries, referer, origin, acceptLanguage }) => {
              const toBase64 = (buf) => {
                const bytes = new Uint8Array(buf);
                let binary = '';
                const chunk = 0x8000;
                for (let i = 0; i < bytes.length; i += chunk) {
                  binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
                }
                return btoa(binary);
              };
              return Promise.all(entries.map(async ({ key, url }) => {
                try {
                  const res = await fetch(url, {
                    headers: {
                      referer,
                      origin,
                      'accept-language': acceptLanguage,
                    },
                    credentials: 'include',
                  });
                  const buf = await res.arrayBuffer();
                  return {
                    key,
                    ok: res.ok,
                    status: res.status,
                    bodyLen: buf.byteLength,
                    body: res.ok && buf.byteLength > 0 ? toBase64(buf) : null,
                    error: res.ok ? null : ('status ' + res.status),
                  };
                } catch (err) {
                  return { key, ok: false, status: 0, bodyLen: 0, body: null, error: String(err) };
                }
              }));
            }
            """;

    private static final String SINGLE_FETCH_SCRIPT = """
            async ({ url, referer, origin, acceptLanguage }) => {
              const toBase64 = (buf) => {
                const bytes = new Uint8Array(buf);
                let binary = '';
                const chunk = 0x8000;
                for (let i = 0; i < bytes.length; i += chunk) {
                  binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
                }
                return btoa(binary);
              };
              try {
                const res = await fetch(url, {
                  headers: {
                    referer,
                    origin,
                    'accept-language': acceptLanguage,
                  },
                  credentials: 'include',
                });
                const buf = await res.arrayBuffer();
                return {
                  ok: res.ok,
                  status: res.status,
                  bodyLen: buf.byteLength,
                  body: res.ok && buf.byteLength > 0 ? toBase64(buf) : null,
                  error: res.ok ? null : ('status ' + res.status),
                };
              } catch (err) {
                return { ok: false, status: 0, bodyLen: 0, body: null, error: String(err) };
              }
            }
            """;

    private final PlaywrightProperties properties;

    public byte[] fetchRequired(Page page, String apiUrl, String referer) {
        var body = fetchOptional(page, apiUrl, referer);
        if (body == null || body.length == 0) {
            throw new AiscoreBadGatewayException(
                    "AiScore API fetch returned no body",
                    Map.of("apiUrl", apiUrl)
            );
        }
        return body;
    }

    public byte[] fetchOptional(Page page, String apiUrl) {
        page.waitForTimeout(200);
        return fetchOptional(page, apiUrl, ORIGIN);
    }

    public byte[] fetchOptional(Page page, String apiUrl, String referer) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> result = (Map<String, Object>) page.evaluate(
                    SINGLE_FETCH_SCRIPT,
                    fetchParams(apiUrl, referer)
            );
            return decodeResultBody(result);
        } catch (RuntimeException ex) {
            log.log(Level.WARNING, "Fetching AiScore API failed for url: " + apiUrl, ex);
            return null;
        }
    }

    public Map<String, byte[]> fetchParallel(Page page, Map<String, String> urlsByKey, String referer) {
        if (urlsByKey.isEmpty()) {
            return Map.of();
        }
        var entries = urlsByKey.entrySet().stream()
                .map(entry -> Map.of("key", entry.getKey(), "url", entry.getValue()))
                .toList();
        try {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> results = (List<Map<String, Object>>) page.evaluate(
                    PARALLEL_FETCH_SCRIPT,
                    Map.of(
                            "entries", entries,
                            "referer", referer,
                            "origin", ORIGIN,
                            "acceptLanguage", properties.acceptLanguage()
                    )
            );
            var bodies = new LinkedHashMap<String, byte[]>();
            for (var result : results) {
                var key = String.valueOf(result.get("key"));
                var body = decodeResultBody(result);
                if (body != null && body.length > 0) {
                    bodies.put(key, body);
                }
            }
            return bodies;
        } catch (RuntimeException ex) {
            return Map.of();
        }
    }

    private Map<String, String> fetchParams(String apiUrl, String referer) {
        return Map.of(
                "url", apiUrl,
                "referer", referer,
                "origin", ORIGIN,
                "acceptLanguage", properties.acceptLanguage()
        );
    }

    private static byte[] decodeResultBody(Map<String, Object> result) {
        if (!Boolean.TRUE.equals(result.get("ok"))) {
            return null;
        }
        var encoded = result.get("body");
        if (!(encoded instanceof String base64) || base64.isBlank()) {
            return null;
        }
        try {
            return Base64.getDecoder().decode(base64);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
