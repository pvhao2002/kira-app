package kira.datamanager.event;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record EventCrawlFailedRowResponse(
        @JsonProperty("eventId") long eventId,
        String type,
        String message,
        String screenshot,
        LocalDateTime createdAt,
        String eventName,
        LocalDateTime eventDate,
        String status,
        String link
) {
}
