package com.queue.kiraqueue.dto.model;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class EventResult {
    Long eventId;
    String htResult;
    String htGoalStr;
    String ftResult;
    String ftGoalStr;

    Integer htHomeGoal;
    Integer htAwayGoal;
    Integer ftHomeGoal;
    Integer ftAwayGoal;
    Integer htTotalGoal;
    Integer ftTotalGoal;

    Integer htHomeCorner;
    Integer htAwayCorner;
    Integer ftHomeCorner;
    Integer ftAwayCorner;
    Integer htTotalCorner;
    Integer ftTotalCorner;

    Integer htHomeYellowCard;
    Integer htAwayYellowCard;
    Integer ftHomeYellowCard;
    Integer ftAwayYellowCard;
    Integer htTotalYellowCard;
    Integer ftTotalYellowCard;

    Integer htHomeFoul;
    Integer htAwayFoul;
    Integer ftHomeFoul;
    Integer ftAwayFoul;
    Integer htTotalFoul;
    Integer ftTotalFoul;

    Integer htHomeOffside;
    Integer htAwayOffside;
    Integer ftHomeOffside;
    Integer ftAwayOffside;
    Integer htTotalOffside;
    Integer ftTotalOffside;

    Integer htHomeTotalShot;
    Integer htAwayTotalShot;
    Integer ftHomeTotalShot;
    Integer ftAwayTotalShot;
    Integer htTotalShot;
    Integer ftTotalShot;

    Integer htHomeShotOnTarget;
    Integer htAwayShotOnTarget;
    Integer ftHomeShotOnTarget;
    Integer ftAwayShotOnTarget;
    Integer htTotalShotOnTarget;
    Integer ftTotalShotOnTarget;

    LocalDateTime createdAt;
    LocalDateTime updatedAt;
}
