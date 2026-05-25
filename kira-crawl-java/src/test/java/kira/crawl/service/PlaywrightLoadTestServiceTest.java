package kira.crawl.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PlaywrightLoadTestServiceTest {

    @Test
    void defaultUrlsHasFiveEntries() {
        assertEquals(5, PlaywrightLoadTestService.defaultUrls().size());
    }

    @Test
    void parseUrlsParamSplitsCommaSeparated() {
        var urls = PlaywrightLoadTestService.parseUrlsParam(
                "https://www.aiscore.com/20180101, https://www.aiscore.com/20180102"
        );
        assertEquals(2, urls.size());
    }

    @Test
    void validateUrlsRejectsWrongCount() {
        assertThrows(IllegalArgumentException.class, () ->
                PlaywrightLoadTestService.validateUrls(List.of("https://www.aiscore.com/20180101"))
        );
    }

    @Test
    void validateUrlsRejectsNonAiscoreHost() {
        assertThrows(IllegalArgumentException.class, () ->
                PlaywrightLoadTestService.validateUrls(List.of(
                        "https://www.aiscore.com/20180101",
                        "https://www.aiscore.com/20180102",
                        "https://www.aiscore.com/20180103",
                        "https://www.aiscore.com/20180104",
                        "https://example.com/20180105"
                ))
        );
    }

    @Test
    void validateUrlsAcceptsFiveAiscoreUrls() {
        PlaywrightLoadTestService.validateUrls(PlaywrightLoadTestService.defaultUrls());
        assertTrue(true);
    }
}
