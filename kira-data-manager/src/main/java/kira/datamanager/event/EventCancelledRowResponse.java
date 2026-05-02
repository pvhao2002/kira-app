package kira.datamanager.event;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record EventCancelledRowResponse(
        @JsonProperty("eventId") long eventId,
        String eventName,
        LocalDateTime eventDate,
        String status,
        String link,
        LocalDateTime createdAt
) {
}
