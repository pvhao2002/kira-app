package com.queue.kiraqueue.dto.crawl;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record MatchOddsResponse(
        String matchId,
        CrawlMatchOddsEventDto event,
        CrawlEventResultDto eventResult,
        List<CrawlOddsSnapshotDto> odds,
        @JsonAlias("timelineOdds") CrawlOddsTimelineGroupDto oddsTimeline
) {
    public boolean isEmpty() {
        if (matchId != null && !matchId.isBlank()) {
            return false;
        }
        var hasOdds = odds != null && !odds.isEmpty();
        var hasEvent = event != null;
        var hasTimeline = oddsTimeline != null;
        return !hasOdds && !hasEvent && !hasTimeline;
    }
}
