package kira.crawl.mapper;

import com.fasterxml.jackson.databind.ObjectMapper;
import kira.crawl.dto.CrawlEventResultDto;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class MatchMapperTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private final MatchMapper matchMapper = new MatchMapper();

    @Test
    void mapEventResultFromCrawlFallsBackToScoresWhenTeamStatsMissing() {
        var result = matchMapper.mapEventResultFromCrawl(
                List.of(2, 1, 0, 0, 3),
                List.of(0, 0, 0, 0, 1),
                null
        );

        assertEquals("H", result.ftResult());
        assertEquals("2-0", result.ftGoalStr());
        assertEquals(2, result.ftHomeGoal());
        assertEquals(0, result.ftAwayGoal());
    }

    @Test
    void mapEventResultFromCrawlUsesTeamStatsWhenPresent() throws Exception {
        var teamStats = OBJECT_MAPPER.readTree("""
                {
                  "matchStats": {
                    "0": { "stats": { "102": { "values": ["4", "2"] } } },
                    "1": { "stats": { "102": { "values": ["1", "0"] } } }
                  }
                }
                """);

        CrawlEventResultDto result = matchMapper.mapEventResultFromCrawl(
                List.of(2, 1),
                List.of(0, 0),
                teamStats
        );

        assertNotNull(result);
        assertEquals("H", result.ftResult());
        assertEquals(4, result.ftHomeCorner());
        assertEquals(2, result.ftAwayCorner());
        assertEquals(1, result.htHomeCorner());
        assertEquals(0, result.htAwayCorner());
    }
}
