package kira.crawl.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CrawlOddsTimelineGroupDto(
        List<CrawlOddsTimelineItemDto> hdc,
        List<CrawlOddsTimelineItemDto> ou,
        List<CrawlOddsTimelineItemDto> corner
) {
}
