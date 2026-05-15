package kira.datamanager.event;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record EventDataIssueScreenshotResponse(
        @JsonProperty("eventId") long eventId,
        String issueType,
        LocalDateTime recordedAt,
        String screenshot
) {
}
