package kira.crawl.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CrawlOddsTimelineItemDto(
        String market,
        String line,
        String priceA,
        String priceB,
        String matchMinute,
        String crawledAt,
        String score,
        Integer statusId
) {
}
