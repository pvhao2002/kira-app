package kira.crawl.browser;

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

    private final PlaywrightProperties properties;
    private final PlaywrightCrawlLanes crawlLanes;

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
        log.info("Opening crawl page for {} at {}", apiType, publicPageUrl);
        return crawlLanes.lane(apiType).withPage(timeout, headers, handler);
    }
}
