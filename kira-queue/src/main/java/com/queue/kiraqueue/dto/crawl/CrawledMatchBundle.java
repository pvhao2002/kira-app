package com.queue.kiraqueue.dto.crawl;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record CrawledMatchBundle(
        CrawlLeagueDto league,
        CrawlTeamDto homeTeam,
        CrawlTeamDto awayTeam,
        CrawlEventDto event,
        CrawlEventResultDto result
) {
}
