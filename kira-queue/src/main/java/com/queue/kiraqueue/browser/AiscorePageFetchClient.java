package com.queue.kiraqueue.browser;

import com.microsoft.playwright.Page;
import com.queue.kiraqueue.config.AiscoreBadGatewayException;
import com.queue.kiraqueue.config.BusinessException;
import com.queue.kiraqueue.config.PlaywrightProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.stereotype.Component;
import org.springframework.http.HttpStatus;

import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
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
                  const contentType = res.headers.get('content-type') || '';
                  const mitigated = res.headers.get('cf-mitigated') || '';
                  const challengeText = contentType.toLowerCase().includes('text/html')
                    ? new TextDecoder().decode(buf.slice(0, 8192)).toLowerCase()
                    : '';
                  const challenge = mitigated.toLowerCase() === 'challenge'
                    || challengeText.includes('just a moment')
                    || challengeText.includes('verify you are human')
                    || challengeText.includes('cf-chl-');
                  return {
                    key,
                    ok: res.ok,
                    status: res.status,
                    contentType,
                    mitigated,
                    challenge,
                    bodyLen: buf.byteLength,
                    body: res.ok && buf.byteLength > 0 ? toBase64(buf) : null,
                    error: res.ok ? null : ('status ' + res.status),
                  };
                } catch (err) {
                  return { key, ok: false, status: 0, bodyLen: 0, body: null, challenge: false, error: String(err) };
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
                const contentType = res.headers.get('content-type') || '';
                const mitigated = res.headers.get('cf-mitigated') || '';
                const challengeText = contentType.toLowerCase().includes('text/html')
                  ? new TextDecoder().decode(buf.slice(0, 8192)).toLowerCase()
                  : '';
                const challenge = mitigated.toLowerCase() === 'challenge'
                  || challengeText.includes('just a moment')
                  || challengeText.includes('verify you are human')
                  || challengeText.includes('cf-chl-');
                return {
                  ok: res.ok,
                  status: res.status,
                  contentType,
                  mitigated,
                  challenge,
                  bodyLen: buf.byteLength,
                  body: res.ok && buf.byteLength > 0 ? toBase64(buf) : null,
                  error: res.ok ? null : ('status ' + res.status),
                };
              } catch (err) {
                return { ok: false, status: 0, bodyLen: 0, body: null, challenge: false, error: String(err) };
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
        CloudflareSupport.requireClearance(page, properties.verificationTimeoutMs());
        for (int attempt = 0; attempt < 2; attempt++) {
            try {
                @SuppressWarnings("unchecked")
                Map<String, Object> result = (Map<String, Object>) page.evaluate(
                        SINGLE_FETCH_SCRIPT,
                        fetchParams(apiUrl, referer)
                );
                var body = decodeResultBody(apiUrl, result);
                if (body == null) {
                    log.warning("AiScore API fetch context url=" + apiUrl + " referer=" + referer);
                }
                return body;
            } catch (BusinessException ex) {
                if (attempt == 0 && isVerificationRequired(ex)) {
                    CloudflareSupport.requireClearanceAfterApiChallenge(page, properties.verificationTimeoutMs());
                    continue;
                }
                throw ex;
            } catch (RuntimeException ex) {
                log.log(Level.WARNING, "AiScore API fetch error url=" + apiUrl + " referer=" + referer, ex);
                return null;
            }
        }
        throw new BusinessException("AISCORE_VERIFICATION_REQUIRED: AiScore API challenge was not cleared.",
                HttpStatus.SERVICE_UNAVAILABLE);
    }

    public Map<String, byte[]> fetchParallel(Page page, Map<String, String> urlsByKey, String referer) {
        if (urlsByKey.isEmpty()) {
            return Map.of();
        }
        CloudflareSupport.requireClearance(page, properties.verificationTimeoutMs());
        var entries = urlsByKey.entrySet().stream()
                .map(entry -> Map.of("key", entry.getKey(), "url", entry.getValue()))
                .toList();
        for (int attempt = 0; attempt < 2; attempt++) {
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
                    var apiUrl = urlsByKey.get(key);
                    var body = decodeResultBody(apiUrl, result);
                    if (body != null && body.length > 0) {
                        bodies.put(key, body);
                    }
                }
                return bodies;
            } catch (BusinessException ex) {
                if (attempt == 0 && isVerificationRequired(ex)) {
                    CloudflareSupport.requireClearanceAfterApiChallenge(page, properties.verificationTimeoutMs());
                    continue;
                }
                throw ex;
            } catch (RuntimeException ex) {
                log.log(Level.WARNING, "AiScore API parallel fetch error referer=" + referer, ex);
                return Map.of();
            }
        }
        throw new BusinessException("AISCORE_VERIFICATION_REQUIRED: AiScore API challenge was not cleared.",
                HttpStatus.SERVICE_UNAVAILABLE);
    }

    private Map<String, String> fetchParams(String apiUrl, String referer) {
        return Map.of(
                "url", apiUrl,
                "referer", referer,
                "origin", ORIGIN,
                "acceptLanguage", properties.acceptLanguage()
        );
    }

    private static byte[] decodeResultBody(String apiUrl, Map<String, Object> result) {
        var status = toInt(result.get("status"));
        var bodyLen = toInt(result.get("bodyLen"));
        var error = result.get("error") != null ? String.valueOf(result.get("error")) : null;

        if (Boolean.TRUE.equals(result.get("challenge"))
                || "challenge".equalsIgnoreCase(String.valueOf(result.get("mitigated")))) {
            throw new BusinessException(
                    "AISCORE_VERIFICATION_REQUIRED: AiScore API returned a Cloudflare challenge. Crawl stopped.",
                    HttpStatus.SERVICE_UNAVAILABLE);
        }
        if (status == 403 || status == 429 || status == 503) {
            throw new BusinessException(
                    "AISCORE_UPSTREAM_UNAVAILABLE: AiScore API returned HTTP " + status + ". Crawl stopped.",
                    HttpStatus.SERVICE_UNAVAILABLE);
        }
        var contentType = String.valueOf(result.get("contentType")).toLowerCase(Locale.ROOT);
        if (contentType.contains("text/html") || contentType.contains("application/xhtml+xml")) {
            throw new BusinessException(
                    "AISCORE_UNEXPECTED_RESPONSE: AiScore returned HTML instead of odds data. Crawl stopped.",
                    HttpStatus.BAD_GATEWAY);
        }

        if (!Boolean.TRUE.equals(result.get("ok"))) {
            log.warning(
                    "AiScore API fetch failed url=" + apiUrl
                            + " status=" + status
                            + " bodyLen=" + bodyLen
                            + " error=" + error
            );
            return null;
        }
        var encoded = result.get("body");
        if (!(encoded instanceof String base64) || base64.isBlank()) {
            log.warning(
                    "AiScore API fetch returned empty body url=" + apiUrl
                            + " status=" + status
                            + " bodyLen=" + bodyLen
            );
            return null;
        }
        try {
            var body = Base64.getDecoder().decode(base64);
            log.info("AiScore API fetch ok url=" + apiUrl + " status=" + status + " bodyLen=" + bodyLen);
            return body;
        } catch (IllegalArgumentException ex) {
            log.warning(
                    "AiScore API fetch decode failed url=" + apiUrl
                            + " status=" + status
                            + " bodyLen=" + bodyLen
            );
            return null;
        }
    }

    private static int toInt(Object value) {
        return value instanceof Number number ? number.intValue() : 0;
    }

    private static boolean isVerificationRequired(BusinessException ex) {
        return ex.getMessage() != null && ex.getMessage().startsWith("AISCORE_VERIFICATION_REQUIRED");
    }
}
