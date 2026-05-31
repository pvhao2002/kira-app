package kira.crawl.service;

import kira.crawl.dto.OddsV4BenchmarkFixture;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OddsV4BenchmarkServiceTest {

    private static final String FIXTURE_URL =
            "https://www.aiscore.com/match-sk-treibach-sc-gleisdorf/527r3i4954pu47e";

    @Test
    void defaultFixturesHasSixEntries() {
        assertEquals(6, OddsV4BenchmarkService.defaultFixtures().size());
        assertTrue(OddsV4BenchmarkService.defaultFixtures().getFirst().hasOddsCorner());
        assertFalse(OddsV4BenchmarkService.defaultFixtures().get(3).hasOddsCorner());
    }

    @Test
    void parseFixturesParamSplitsPipeSeparatedPairs() {
        var fixtures = OddsV4BenchmarkService.parseFixturesParam(
                FIXTURE_URL + ",true|https://www.aiscore.com/match-elfsborg-mjallby-aif/g6763i5lw3jio7r,false"
        );
        assertEquals(2, fixtures.size());
        assertEquals(FIXTURE_URL, fixtures.get(0).eventLink());
        assertTrue(fixtures.get(0).hasOddsCorner());
        assertFalse(fixtures.get(1).hasOddsCorner());
    }

    @Test
    void parseFixturesParamReturnsEmptyForBlank() {
        assertTrue(OddsV4BenchmarkService.parseFixturesParam(null).isEmpty());
        assertTrue(OddsV4BenchmarkService.parseFixturesParam("  ").isEmpty());
    }

    @Test
    void parseFixturesParamRejectsMissingComma() {
        assertThrows(IllegalArgumentException.class, () ->
                OddsV4BenchmarkService.parseFixturesParam(FIXTURE_URL)
        );
    }

    @Test
    void parseFixturesParamRejectsInvalidBoolean() {
        assertThrows(IllegalArgumentException.class, () ->
                OddsV4BenchmarkService.parseFixturesParam(FIXTURE_URL + ",yes")
        );
    }

    @Test
    void validateFixturesRejectsEmptyList() {
        assertThrows(IllegalArgumentException.class, () ->
                OddsV4BenchmarkService.validateFixtures(List.of())
        );
    }

    @Test
    void validateFixturesRejectsTooMany() {
        var fixtures = java.util.stream.IntStream.range(0, 11)
                .mapToObj(i -> new OddsV4BenchmarkFixture(FIXTURE_URL, true))
                .toList();
        assertThrows(IllegalArgumentException.class, () ->
                OddsV4BenchmarkService.validateFixtures(fixtures)
        );
    }

    @Test
    void validateFixturesRejectsNonAiscoreHost() {
        assertThrows(IllegalArgumentException.class, () ->
                OddsV4BenchmarkService.validateFixtures(List.of(
                        new OddsV4BenchmarkFixture("https://example.com/match/foo/bar", true)
                ))
        );
    }

    @Test
    void validateFixturesAcceptsDefaultFixtures() {
        OddsV4BenchmarkService.validateFixtures(OddsV4BenchmarkService.defaultFixtures());
    }
}
