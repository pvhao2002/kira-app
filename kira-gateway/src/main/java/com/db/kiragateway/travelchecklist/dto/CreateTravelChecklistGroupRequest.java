package com.db.kiragateway.travelchecklist.dto;

import com.db.kiragateway.travelchecklist.TravelChecklistScheduleType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalTime;

public record CreateTravelChecklistGroupRequest(
        @NotNull TravelChecklistScheduleType scheduleType,
        LocalDate scheduleDate,
        LocalTime startTime,
        LocalTime endTime,
        @NotBlank @Size(max = 255) String title,
        Integer sortOrder
) {
}
