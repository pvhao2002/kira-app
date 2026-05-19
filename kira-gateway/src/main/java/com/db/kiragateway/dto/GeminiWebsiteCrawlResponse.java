package com.db.kiragateway.dto;

import java.math.BigDecimal;
import java.util.List;

public record GeminiWebsiteCrawlResponse(
        String status,
        String model,
        GeminiWebsiteCrawlData data
) {
    public record GeminiWebsiteCrawlData(
            String sourceUrl,
            String promptHash,
            String rawResponse,
            List<EventRow> events,
            List<EventResultRow> eventResults,
            List<EventOddsRow> eventOdds,
            List<EventOddsTimelineRow> eventOddsTimeline
    ) {
    }

    public record EventRow(
            String externalId,
            String homeName,
            String awayName,
            String homeUrl,
            String awayUrl,
            String eventName,
            String eventDate,
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

    public record EventResultRow(
            String externalId,
            Long eventId,
            String htResult,
            String htGoalStr,
            String ftResult,
            String ftGoalStr,
            Integer htHomeGoal,
            Integer htAwayGoal,
            Integer ftHomeGoal,
            Integer ftAwayGoal,
            Integer htHomeCorner,
            Integer htAwayCorner,
            Integer ftHomeCorner,
            Integer ftAwayCorner,
            Integer htHomeYellowCard,
            Integer htAwayYellowCard,
            Integer ftHomeYellowCard,
            Integer ftAwayYellowCard,
            Integer htHomeFoul,
            Integer htAwayFoul,
            Integer ftHomeFoul,
            Integer ftAwayFoul,
            Integer htHomeOffside,
            Integer htAwayOffside,
            Integer ftHomeOffside,
            Integer ftAwayOffside,
            Integer htHomeTotalShot,
            Integer htAwayTotalShot,
            Integer ftHomeTotalShot,
            Integer ftAwayTotalShot,
            Integer htHomeShotOnTarget,
            Integer htAwayShotOnTarget,
            Integer ftHomeShotOnTarget,
            Integer ftAwayShotOnTarget
    ) {
    }

    public record EventOddsRow(
            String externalId,
            Long eventId,
            String type,
            String market,
            String line,
            BigDecimal priceA,
            BigDecimal priceB
    ) {
    }

    public record EventOddsTimelineRow(
            String externalId,
            Long eventId,
            String market,
            String line,
            BigDecimal priceA,
            BigDecimal priceB,
            String matchMinute,
            String crawledAt
    ) {
    }
}
