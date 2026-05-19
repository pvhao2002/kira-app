package kira.datamanager.event;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record SoccerTeamRecentStatRowResponse(
        int rankNo,
        int teamId,
        String teamName,
        int eligibleMatchCount,
        int matchedMatchCount,
        BigDecimal percentage,
        LocalDate windowStart,
        LocalDate windowEnd,
        LocalDateTime computedAt
) {
}
