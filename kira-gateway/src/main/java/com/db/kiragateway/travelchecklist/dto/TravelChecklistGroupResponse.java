package com.db.kiragateway.travelchecklist.dto;

import com.db.kiragateway.travelchecklist.TravelChecklistScheduleType;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

public record TravelChecklistGroupResponse(
        long groupId,
        TravelChecklistScheduleType scheduleType,
        LocalDate scheduleDate,
        LocalTime startTime,
        LocalTime endTime,
        String title,
        int sortOrder,
        List<TravelChecklistItemResponse> items,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
