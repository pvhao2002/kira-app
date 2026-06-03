package kira.crawl.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MatchOddsResponseDto(
        String matchId,
        CrawlMatchOddsEventDto event,
        CrawlEventResultDto eventResult,
        List<CrawlOddsSnapshotDto> odds,
        CrawlOddsTimelineGroupDto oddsTimeline,
        Map<String, Object> aiscoreRaw
) {
    public boolean isEmpty() {
        return matchId == null || matchId.isBlank();
    }
    public static MatchOddsResponseDto empty() {
        return new MatchOddsResponseDto(null, null, null, List.of(), null, Map.of());
    }
}
