package com.db.kiragateway.travelchecklist;

import java.time.LocalDateTime;

public record TravelChecklistPlanRow(
        long planId,
        int userId,
        String planName,
        boolean published,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
