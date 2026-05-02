package kira.datamanager.event;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record EventNoOddsRowResponse(
        @JsonProperty("eventId") long eventId,
        LocalDateTime recordedAt,
        String eventName,
        LocalDateTime eventDate,
        String status,
        String link
) {
}
