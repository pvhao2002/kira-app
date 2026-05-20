package com.queue.kiraqueue.dto.crawl;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record MatchesResponse(
        String date,
        Integer sportId,
        Integer lang,
        String tz,
        Integer total,
        List<CrawledMatchBundle> events
) {
}
