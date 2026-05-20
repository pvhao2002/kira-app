package com.queue.kiraqueue.dto.crawl;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record CrawlOddsSnapshotDto(
        String type,
        String market,
        String line,
        String priceA,
        String priceB
) {
}
