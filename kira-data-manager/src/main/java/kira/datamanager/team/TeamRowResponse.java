package kira.datamanager.team;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record TeamRowResponse(
        @JsonProperty("teamId") int teamId,
        @JsonProperty("teamName") String teamName,
        @JsonProperty("logoUrl") String logoUrl,
        String logo,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
