package kira.crawl.service;

import kira.crawl.config.PlaywrightProperties;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MatchesBenchmarkServiceTest {

    private static final PlaywrightProperties PROPERTIES = new PlaywrightProperties(
            true,
            "",
            80_000,
            180_000,
            300_000,
            "ua",
            "en",
            "",
            ".playwright",
            "",
            4000,
            1,
            1,
            120_000,
            ""
    );

    private final MatchesBenchmarkService service = new MatchesBenchmarkService(PROPERTIES);

    @Test
    void defaultDatesHasFiveEntries() {
        assertEquals(5, MatchesBenchmarkService.defaultDates().size());
        assertEquals("20260101", MatchesBenchmarkService.defaultDates().getFirst());
        assertEquals("20260105", MatchesBenchmarkService.defaultDates().get(4));
    }

    @Test
    void buildMatchesUrlUsesExpectedQueryParams() {
        var url = MatchesBenchmarkService.buildMatchesUrl("http://localhost:4000", "20260103");
        assertEquals(
                "http://localhost:4000/matches?raw=false&tz=07%3A00&lang=2&sport_id=1&date=20260103",
                url
        );
    }

    @Test
    void buildMatchesUrlStripsTrailingSlashFromBase() {
        var url = MatchesBenchmarkService.buildMatchesUrl("http://localhost:4000/", "20260101");
        assertTrue(url.startsWith("http://localhost:4000/matches?"));
    }

    @Test
    void parseDatesParamSplitsCommaSeparated() {
        var dates = MatchesBenchmarkService.parseDatesParam("20260101, 20260102, 20260103");
        assertEquals(3, dates.size());
    }

    @Test
    void validateDatesRejectsWrongCount() {
        assertThrows(IllegalArgumentException.class, () ->
                MatchesBenchmarkService.validateDates(List.of("20260101"))
        );
    }

    @Test
    void validateDatesRejectsInvalidFormat() {
        assertThrows(IllegalArgumentException.class, () ->
                MatchesBenchmarkService.validateDates(List.of(
                        "20260101",
                        "20260102",
                        "20260103",
                        "20260104",
                        "2026-01-05"
                ))
        );
    }

    @Test
    void validateDatesAcceptsFiveDates() {
        MatchesBenchmarkService.validateDates(MatchesBenchmarkService.defaultDates());
        assertTrue(true);
    }

    @Test
    void resolveBaseUrlDefaultsToLocalhostAndPort() {
        assertEquals("http://localhost:4000", service.resolveBaseUrl(null));
    }

    @Test
    void resolveBaseUrlUsesOverride() {
        assertEquals(
                "http://localhost:4001",
                service.resolveBaseUrl("http://localhost:4001/")
        );
    }
}
