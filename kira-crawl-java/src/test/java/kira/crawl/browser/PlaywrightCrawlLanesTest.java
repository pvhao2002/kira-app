package kira.crawl.browser;

import kira.crawl.config.PlaywrightProperties;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;

class PlaywrightCrawlLanesTest {

    private PlaywrightCrawlLanes lanes;

    @AfterEach
    void tearDown() {
        if (lanes != null) {
            lanes.close();
        }
    }

    @Test
    void laneReturnsStableInstancePerApiType() {
        lanes = new PlaywrightCrawlLanes(testProperties());

        var matchesLane = lanes.lane(BrowserApiType.MATCHES);
        var oddsLane = lanes.lane(BrowserApiType.ODDS);

        assertSame(matchesLane, lanes.lane(BrowserApiType.MATCHES));
        assertSame(oddsLane, lanes.lane(BrowserApiType.ODDS));
        assertNotSame(matchesLane, oddsLane);
        assertEquals(BrowserApiType.MATCHES, matchesLane.apiType());
        assertEquals(BrowserApiType.ODDS, oddsLane.apiType());
    }

    @Test
    void laneRejectsNullLookup() {
        lanes = new PlaywrightCrawlLanes(testProperties());
        assertThrows(IllegalArgumentException.class, () -> lanes.lane(null));
    }

    @Test
    void laneRejectsWorkAfterClose() {
        lanes = new PlaywrightCrawlLanes(testProperties());
        var matchesLane = lanes.lane(BrowserApiType.MATCHES);

        lanes.close();

        assertThrows(IllegalStateException.class, matchesLane::warmup);
    }

    private static PlaywrightProperties testProperties() {
        return new PlaywrightProperties(
                true,
                null,
                80_000L,
                180_000L,
                300_000L,
                "test-agent",
                "en-US",
                "",
                ".playwright",
                "",
                4000,
                1,
                1,
                120_000L,
                ""
        );
    }
}
