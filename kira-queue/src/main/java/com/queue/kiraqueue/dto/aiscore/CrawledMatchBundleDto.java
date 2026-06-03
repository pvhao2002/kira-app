package com.queue.kiraqueue.dto.aiscore;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CrawledMatchBundleDto(
        CrawlLeagueDto league,
        CrawlTeamDto homeTeam,
        CrawlTeamDto awayTeam,
        CrawlEventDto event,
        CrawlEventResultDto result
) {
}
