package com.queue.kiraqueue.dto.crawl;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record CrawlOddsTimelineItemDto(
        String market,
        String line,
        String priceA,
        String priceB,
        String matchMinute,
        String crawledAt
) {
}
