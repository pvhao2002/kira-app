package com.db.kiragateway.travelchecklist.dto;

import jakarta.validation.constraints.Size;

public record UpdateTravelChecklistPlanRequest(
        @Size(max = 255) String planName,
        Boolean published
) {
}
