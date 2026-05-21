package kira.crawl.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
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
