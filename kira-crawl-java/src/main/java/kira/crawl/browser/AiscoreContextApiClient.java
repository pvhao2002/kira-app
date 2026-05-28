package kira.crawl.browser;

import com.microsoft.playwright.APIResponse;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.RequestOptions;
import kira.crawl.service.AiscoreBadGatewayException;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Fetches AiScore protobuf APIs using the browser context cookie jar (no extra navigation).
 */
@Component
public class AiscoreContextApiClient {

    public byte[] getOptional(Page page, String apiUrl, String referer, long timeoutMs) {
        APIResponse response;
        try {
            response = page.context().request().get(
                    apiUrl,
                    RequestOptions.create()
                            .setTimeout((double) timeoutMs)
                            .setHeader("referer", referer)
                            .setHeader("origin", "https://www.aiscore.com")
            );
        } catch (RuntimeException ex) {
            return null;
        }
        if (!response.ok()) {
            return null;
        }
        return response.body();
    }

    public byte[] getRequired(Page page, String apiUrl, String referer, long timeoutMs) {
        var body = getOptional(page, apiUrl, referer, timeoutMs);
        if (body == null) {
            throw new AiscoreBadGatewayException(
                    "AiScore API response was not found in page network traffic",
                    Map.of("apiUrl", apiUrl)
            );
        }
        return body;
    }
}
