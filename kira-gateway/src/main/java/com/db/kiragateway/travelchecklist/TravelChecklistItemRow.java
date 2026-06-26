package com.db.kiragateway.travelchecklist;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;

public record TravelChecklistItemRow(
        long itemId,
        long groupId,
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
