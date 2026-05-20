package com.queue.kiraqueue.dto.crawl;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record CrawlEventDto(
        String externalId,
        String leagueExternalId,
        String homeExternalId,
        String awayExternalId,
        String eventName,
        String eventDate,
        String status,
        Integer statusId,
        String link,
        Integer matchStatus
) {
}
