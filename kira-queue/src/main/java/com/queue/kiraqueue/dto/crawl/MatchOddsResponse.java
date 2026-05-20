package com.queue.kiraqueue.dto.crawl;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record MatchOddsResponse(
        String matchId,
        CrawlMatchOddsEventDto event,
        CrawlEventResultDto eventResult,
        List<CrawlOddsSnapshotDto> odds,
        CrawlOddsTimelineGroupDto oddsTimeline
) {
    public boolean isEmpty() {
        return matchId == null || matchId.isBlank();
    }
}
