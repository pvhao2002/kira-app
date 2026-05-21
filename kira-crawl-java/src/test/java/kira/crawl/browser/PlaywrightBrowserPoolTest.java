package kira.crawl.browser;

import kira.crawl.config.PlaywrightProperties;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class PlaywrightBrowserPoolTest {

    @Test
    void poolSizesMatchConfiguration() {
        var properties = new PlaywrightProperties(
                true,
                "",
                80000,
                60000,
                "ua",
                "en-US",
                "",
                ".playwright-test",
                "test",
                4000,
                2,
                4,
                1,
                1000
        );

        try (var pool = new PlaywrightBrowserPool(properties)) {
            assertEquals(2, pool.available(BrowserApiType.MATCHES));
            assertEquals(4, pool.available(BrowserApiType.ODDS));
            assertEquals(1, pool.available(BrowserApiType.RAW));
        }
    }
}
