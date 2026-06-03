package kira.crawl.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MatchesResponseDto(
        String date,
        Integer sportId,
        Integer lang,
        String tz,
        Integer total,
        List<CrawledMatchBundleDto> events,
        Map<String, Object> aiscoreRaw
) {
    public static MatchesResponseDto empty() {
        return new MatchesResponseDto(null, null, null, null, null, List.of(), Map.of());
    }
}
