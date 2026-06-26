package com.db.kiragateway.travelchecklist.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;

public record TravelChecklistItemResponse(
        long itemId,
        LocalTime activityTime,
        String activity,
        String address,
        BigDecimal cost,
        String note,
        boolean checked,
        int sortOrder,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
