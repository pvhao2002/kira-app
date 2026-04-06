package kira.crawl.app.dto;

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
}
