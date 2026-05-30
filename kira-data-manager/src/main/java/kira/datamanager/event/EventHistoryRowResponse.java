package kira.datamanager.event;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record EventHistoryRowResponse(
        @JsonProperty("eventId") long eventId,
        String eventName,
        LocalDateTime eventDate,
        String status,
        String leagueName,
        String leagueLogoUrl,
        String homeTeam,
        String homeLogoUrl,
        String awayTeam,
        String awayLogoUrl,
        // Scores — null when not yet available
        String ftGoalStr,
        Integer ftHomeCorner,
        Integer ftAwayCorner,
        Integer ftHomeYellowCard,
        Integer ftAwayYellowCard,
        // Odds — null when no odds data
        EventHistoryOdds odds,
        String link
) {
}
