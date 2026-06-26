package com.db.kiragateway.travelchecklist.dto;

import com.db.kiragateway.travelchecklist.TravelChecklistScheduleType;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalTime;

public record UpdateTravelChecklistGroupRequest(
        TravelChecklistScheduleType scheduleType,
        LocalDate scheduleDate,
        LocalTime startTime,
        LocalTime endTime,
        @Size(max = 255) String title,
        Integer sortOrder
) {
}
