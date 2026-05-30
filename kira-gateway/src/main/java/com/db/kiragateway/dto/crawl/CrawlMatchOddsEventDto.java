package com.db.kiragateway.dto.crawl;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record CrawlMatchOddsEventDto(
        String status,
        Integer statusId
) {
}
