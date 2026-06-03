package com.queue.kiraqueue.dto.aiscore;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CrawlOddsSnapshotDto(
        String type,
        String market,
        String line,
        String priceA,
        String priceB
) {
}
