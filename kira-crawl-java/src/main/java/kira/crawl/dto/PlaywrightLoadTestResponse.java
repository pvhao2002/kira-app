package kira.crawl.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record PlaywrightLoadTestResponse(
        long totalDurationMs,
        boolean parallel,
        String executionMode,
        int poolSize,
        List<PlaywrightLoadTestLinkResult> results
) {
}
