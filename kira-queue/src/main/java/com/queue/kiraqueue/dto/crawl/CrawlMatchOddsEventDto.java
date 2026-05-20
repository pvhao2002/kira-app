package com.queue.kiraqueue.dto.crawl;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record CrawlMatchOddsEventDto(
        String status,
        Integer statusId
) {
}
