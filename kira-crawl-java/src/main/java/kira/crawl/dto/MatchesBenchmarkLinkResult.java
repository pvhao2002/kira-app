package kira.crawl.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record MatchesBenchmarkLinkResult(
        int index,
        String date,
        String requestUrl,
        long durationMs,
        int httpStatus,
        long responseBytes,
        boolean ok,
        String error
) {
}
