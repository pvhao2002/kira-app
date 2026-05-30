package com.db.kiragateway.dto.crawl;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record CrawlOddsResultRequest(
        String matchId,
        CrawlMatchOddsEventDto event,
        CrawlEventResultDto eventResult,
        List<CrawlOddsSnapshotDto> odds,
        CrawlOddsTimelineGroupDto oddsTimeline
) {
}
