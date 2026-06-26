package com.db.kiragateway.travelchecklist.dto;

import java.time.LocalDateTime;
import java.util.List;

public record TravelChecklistPlanResponse(
        long planId,
        String planName,
        boolean published,
        List<TravelChecklistGroupResponse> groups,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
