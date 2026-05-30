package com.db.kiragateway.dto.crawl;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record CrawlOddsTimelineGroupDto(
        List<CrawlOddsTimelineItemDto> hdc,
        List<CrawlOddsTimelineItemDto> ou,
        List<CrawlOddsTimelineItemDto> corner
) {
}
