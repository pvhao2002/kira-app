package com.queue.kiraqueue.dto.aiscore;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
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
