package com.db.kiragateway.travelchecklist;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

public record TravelChecklistGroupRow(
        long groupId,
        long planId,
        TravelChecklistScheduleType scheduleType,
        LocalDate scheduleDate,
        LocalTime startTime,
        LocalTime endTime,
        String title,
        int sortOrder,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
