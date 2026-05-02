package kira.datamanager.crawl;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record CrawlDateRowResponse(
        String date,
        String status,
        String message,
        @JsonProperty("totalEvents") int totalEvents,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
