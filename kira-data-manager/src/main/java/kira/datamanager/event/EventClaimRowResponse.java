package kira.datamanager.event;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record EventClaimRowResponse(
        @JsonProperty("claimId") long claimId,
        @JsonProperty("eventId") long eventId,
        String claimedBy,
        LocalDateTime claimedAt,
        String status,
        String eventName,
        LocalDateTime eventDate,
        String eventStatus,
        String link
) {
}
