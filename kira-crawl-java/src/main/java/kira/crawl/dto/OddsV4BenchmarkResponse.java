package kira.crawl.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record OddsV4BenchmarkResponse(
        long totalDurationMs,
        boolean parallel,
        int fixtureCount,
        List<OddsV4BenchmarkLinkResult> results
) {
}
