package kira.crawl.browser;

import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Page;
import kira.crawl.config.PlaywrightProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.function.BiFunction;

@Component
@RequiredArgsConstructor
@Slf4j
public class BrowserSessionManager {

    private final PlaywrightBrowserPool browserPool;
    private final PlaywrightProperties properties;

    public <T> T withPage(
            BrowserApiType apiType,
            String publicPageUrl,
            BiFunction<Page, Long, T> handler
    ) {
        return browserPool.withContext(apiType, context -> {
            var timeout = properties.browserTimeoutMs();
            var page = context.newPage();
            page.setDefaultTimeout(timeout);
            page.setDefaultNavigationTimeout(timeout);
            page.setExtraHTTPHeaders(Map.of(
                    "referer", publicPageUrl,
                    "origin", "https://www.aiscore.com",
                    "accept-language", properties.acceptLanguage()
            ));
            try {
                return handler.apply(page, timeout);
            } finally {
                try {
                    page.close();
                } catch (Exception ex) {
                    log.warn("Failed to close Playwright page for {}", apiType, ex);
                }
            }
        });
    }
}
