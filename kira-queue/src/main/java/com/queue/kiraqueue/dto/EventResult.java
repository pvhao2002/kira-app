package com.queue.kiraqueue.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class EventResult {
    private Long eventId;
    private String htResult;
    private String htGoalStr;
    private String ftResult;
    private String ftGoalStr;

    private Integer htHomeGoal;
    private Integer htAwayGoal;
    private Integer ftHomeGoal;
    private Integer ftAwayGoal;
    private Integer ftHomeCorner;
    private Integer ftAwayCorner;
}
