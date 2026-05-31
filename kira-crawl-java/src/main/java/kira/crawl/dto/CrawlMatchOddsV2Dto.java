package kira.crawl.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record CrawlMatchOddsV2Dto(
        CrawlMatchOddsEventDto event,
        CrawlEventResultDto eventResult,
        List<CrawlOddsSnapshotDto> odds,
        CrawlOddsTimelineGroupDto timelineOdds
) {
}
