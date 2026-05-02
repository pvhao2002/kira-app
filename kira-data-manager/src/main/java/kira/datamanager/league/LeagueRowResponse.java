package kira.datamanager.league;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record LeagueRowResponse(
        @JsonProperty("leagueId") int leagueId,
        @JsonProperty("leagueName") String leagueName,
        @JsonProperty("logoUrl") String logoUrl,
        String country,
        @JsonProperty("isMain") boolean isMain,
        @JsonProperty("totalEvents") int totalEvents,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
