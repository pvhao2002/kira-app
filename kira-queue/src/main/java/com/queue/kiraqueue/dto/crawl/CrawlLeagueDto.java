package com.queue.kiraqueue.dto.crawl;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record CrawlLeagueDto(
        String externalId,
        String leagueName,
        String logoUrl,
        String country,
        String countryCodeShort,
        Integer hasStats,
        String slug,
        Integer sportId,
        String color
) {
}
