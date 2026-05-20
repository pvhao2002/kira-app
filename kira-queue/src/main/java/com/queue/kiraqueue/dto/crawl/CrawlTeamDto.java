package com.queue.kiraqueue.dto.crawl;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record CrawlTeamDto(
        String externalId,
        String teamName,
        String logoUrl,
        Integer sportId
) {
}
