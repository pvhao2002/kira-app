package kira.crawl.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record MatchesBenchmarkResponse(
        long totalDurationMs,
        boolean parallel,
        String baseUrl,
        List<MatchesBenchmarkLinkResult> results
) {
}
