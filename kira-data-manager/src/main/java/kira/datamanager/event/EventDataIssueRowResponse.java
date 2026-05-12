package kira.datamanager.event;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record EventDataIssueRowResponse(
        @JsonProperty("eventId") long eventId,
        String issueType,
        String description,
        String screenshot,
        LocalDateTime recordedAt,
        String eventName,
        LocalDateTime eventDate,
        String status,
        String link
) {
}
