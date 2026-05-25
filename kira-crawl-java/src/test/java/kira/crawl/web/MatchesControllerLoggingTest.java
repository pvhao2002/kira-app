package kira.crawl.web;

import kira.crawl.dto.MatchOddsResponseDto;
import kira.crawl.dto.MatchesResponseDto;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class MatchesControllerLoggingTest {

    @Test
    void eventLinkSuffix_extractsLastPathSegment() {
        assertEquals(
                "g6763i4gwvvso7r",
                MatchesController.eventLinkSuffix(
                        "https://www.aiscore.com/match-home-away/g6763i4gwvvso7r"
                )
        );
    }

    @Test
    void eventLinkSuffix_handlesBlank() {
        assertEquals("-", MatchesController.eventLinkSuffix("  "));
    }

    @Test
    void summarizeResult_matchesResponse() {
        var dto = new MatchesResponseDto("20260525", 1, 2, "07:00", 3, List.of(), null);
        assertEquals("total=3", MatchesController.summarizeResult(dto));
    }

    @Test
    void summarizeResult_matchOddsResponse() {
        var dto = new MatchOddsResponseDto("m1", null, null, null, null, null);
        assertEquals("matchId=m1", MatchesController.summarizeResult(dto));
    }

    @Test
    void summarizeResult_emptyMap() {
        assertEquals("empty=true", MatchesController.summarizeResult(Map.of()));
    }
}
