package com.db.kiragateway.travelchecklist.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalTime;

public record CreateTravelChecklistItemRequest(
        LocalTime activityTime,
        @NotBlank @Size(max = 512) String activity,
        @Size(max = 512) String address,
        @DecimalMin("0") BigDecimal cost,
        String note,
        Boolean checked,
        Integer sortOrder
) {
}
