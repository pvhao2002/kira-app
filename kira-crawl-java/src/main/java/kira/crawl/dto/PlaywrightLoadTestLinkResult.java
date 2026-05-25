package kira.crawl.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record PlaywrightLoadTestLinkResult(
        int index,
        String url,
        long durationMs,
        String title,
        String finalUrl,
        boolean ok,
        String error
) {
}
