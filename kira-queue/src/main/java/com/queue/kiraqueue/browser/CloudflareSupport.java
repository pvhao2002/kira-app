package com.queue.kiraqueue.browser;

import com.microsoft.playwright.APIResponse;
import com.microsoft.playwright.Page;
import com.queue.kiraqueue.config.BusinessException;
import org.springframework.http.HttpStatus;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;
import java.util.logging.Logger;

public final class CloudflareSupport {
    private static final Logger LOG = Logger.getLogger(CloudflareSupport.class.getName());
    private static final String PAGE_STATE_SCRIPT = """
            () => {
              if (!['aiscore.com', 'www.aiscore.com'].includes(location.hostname)
                  || document.readyState === 'loading' || !document.body) return 'loading';
              const text = ((document.title || '') + '\\n' + (document.body.innerText || '')).toLowerCase();
              if (text.includes('just a moment') || text.includes('checking your browser')
                  || text.includes('performing security verification')
                  || text.includes('verify you are human')
                  || text.includes('enable javascript and cookies')
                  || text.includes('cf-chl-')
                  || document.querySelector('#challenge-running, #challenge-stage, #challenge-form')) {
                return 'challenge';
              }
              return 'ready';
            }
            """;

    private CloudflareSupport() {
    }

    public static boolean waitForClearance(Page page, long timeoutMs) {
        var timeoutNanos = Math.max(0L, timeoutMs) * 1_000_000L;
        var started = System.nanoTime();
        boolean waitingLogged = false;
        do {
            if (page == null || page.isClosed()) {
                return false;
            }
            var state = pageState(page);
            if ("ready".equals(state)) {
                return true;
            }
            if ("challenge".equals(state) && !waitingLogged) {
                LOG.warning("AiScore requires manual verification in the open browser. API requests are paused.");
                waitingLogged = true;
            }
            var remainingNanos = timeoutNanos - (System.nanoTime() - started);
            if (remainingNanos <= 0) {
                return false;
            }
            page.waitForTimeout(Math.min(500, remainingNanos / 1_000_000.0));
        } while (true);
    }

    public static void requireClearance(Page page, long timeoutMs) {
        if (!waitForClearance(page, timeoutMs)) {
            throw new BusinessException(
                    "AISCORE_VERIFICATION_REQUIRED: AiScore page is not ready or still requires verification. "
                            + "Complete verification manually in the open browser, then retry the crawl.",
                    HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    /**
     * An API challenge can arrive while the visible tab still shows a normal page. Reload that
     * same tab so Cloudflare can present its challenge, then wait for the operator to complete it.
     */
    public static void requireClearanceAfterApiChallenge(Page page, long timeoutMs) {
        try {
            page.reload(new Page.ReloadOptions().setTimeout(Math.max(1L, timeoutMs)));
        } catch (RuntimeException ignored) {
            // requireClearance below turns a closed or unreadable page into the stable error code.
        }
        requireClearance(page, timeoutMs);
    }

    /**
     * Rejects an API response that is a Cloudflare challenge or an upstream throttling response.
     * The caller must not parse such a response as an empty protobuf payload.
     */
    public static void requireUsableApiResponse(APIResponse response) {
        if (response == null) {
            return;
        }
        var headers = response.headers();
        var mitigated = headerValue(headers, "cf-mitigated");
        var contentType = headerValue(headers, "content-type").toLowerCase(Locale.ROOT);
        var status = response.status();

        if ("challenge".equalsIgnoreCase(mitigated)) {
            throw verificationRequired("AiScore API returned a Cloudflare challenge");
        }
        if (status == 403 || status == 429 || status == 503) {
            throw new BusinessException(
                    "AISCORE_UPSTREAM_UNAVAILABLE: AiScore API returned HTTP " + status + ". Crawl stopped.",
                    HttpStatus.SERVICE_UNAVAILABLE);
        }
        if ((contentType.contains("text/html") || contentType.contains("application/xhtml+xml"))
                && looksLikeChallenge(response.body())) {
            throw verificationRequired("AiScore API returned a Cloudflare challenge");
        }
        if (contentType.contains("text/html") || contentType.contains("application/xhtml+xml")) {
            throw new BusinessException(
                    "AISCORE_UNEXPECTED_RESPONSE: AiScore returned HTML instead of odds data. Crawl stopped.",
                    HttpStatus.BAD_GATEWAY);
        }
    }

    private static String headerValue(Map<String, String> headers, String name) {
        if (headers == null) {
            return "";
        }
        return headers.entrySet().stream()
                .filter(entry -> name.equalsIgnoreCase(entry.getKey()))
                .map(Map.Entry::getValue)
                .filter(value -> value != null)
                .findFirst()
                .orElse("");
    }

    private static BusinessException verificationRequired(String detail) {
        return new BusinessException(
                "AISCORE_VERIFICATION_REQUIRED: " + detail + ". Crawl stopped.",
                HttpStatus.SERVICE_UNAVAILABLE);
    }

    private static boolean looksLikeChallenge(byte[] body) {
        if (body == null || body.length == 0) {
            return false;
        }
        var sample = new String(body, 0, Math.min(body.length, 8192), StandardCharsets.UTF_8)
                .toLowerCase(Locale.ROOT);
        return sample.contains("just a moment")
                || sample.contains("verify you are human")
                || sample.contains("cf-chl-");
    }

    private static String pageState(Page page) {
        try {
            return String.valueOf(page.evaluate(PAGE_STATE_SCRIPT));
        } catch (RuntimeException ex) {
            // A navigation or unreadable page must never count as successful verification.
            return "loading";
        }
    }
}
