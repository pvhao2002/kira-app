package kira.crawl.browser;

import com.microsoft.playwright.Page;
import kira.crawl.config.PlaywrightProperties;
import kira.crawl.util.PlaywrightUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.function.BiFunction;

@Component
@RequiredArgsConstructor
@Slf4j
public class BrowserSessionManager {

    private final PlaywrightProperties properties;

    public <T> T withPage(
            BrowserApiType apiType,
            String publicPageUrl,
            BiFunction<Page, Long, T> handler
    ) {
        var timeout = properties.browserTimeoutMs();
        var headers = Map.of(
                "referer", publicPageUrl,
                "origin", "https://www.aiscore.com",
                "accept-language", properties.acceptLanguage()
        );
        log.debug("Opening crawl page for {} at {}", apiType, publicPageUrl);
        return PlaywrightUtil.withCrawlPage(timeout, headers, properties.headless(), handler);
    }
}
