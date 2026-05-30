package com.db.kiragateway.dto.crawl;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record CrawlEventResultDto(
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
