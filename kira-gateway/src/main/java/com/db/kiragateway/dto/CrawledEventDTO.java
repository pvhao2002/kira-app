package com.db.kiragateway.dto;

import java.time.LocalDateTime;

public record CrawledEventDTO(
        String externalId,
        String homeName,
        String awayName,
        String homeUrl,
        String awayUrl,
        String eventName,
        LocalDateTime eventDate,
        String countryName,
        String leagueName,
        String leagueUrl,
        String detailLink,
        Integer ftHomeScore,
        Integer ftAwayScore,
        Integer htHomeScore,
        Integer htAwayScore,
        String ftScoreStr,
        String htScoreStr,
        Integer homeCorner,
        Integer awayCorner,
        String providerStatus
) {
    public String htResult() {
        return computeResult(htHomeScore, htAwayScore);
    }

    public String ftResult() {
        return computeResult(ftHomeScore, ftAwayScore);
    }

    private static String computeResult(Integer home, Integer away) {
        if (home == null || away == null) return "None";
        if (home > away) return "H";
        if (home < away) return "A";
        return "D";
    }
}
