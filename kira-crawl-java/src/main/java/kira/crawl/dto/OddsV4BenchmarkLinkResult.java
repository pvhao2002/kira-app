package kira.crawl.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record OddsV4BenchmarkLinkResult(
        int index,
        String eventLink,
        boolean hasOddsCorner,
        long durationMs,
        String matchId,
        boolean ok,
        String error
) {
}
