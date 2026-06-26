package com.db.kiragateway.travelchecklist.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateTravelChecklistPlanRequest(
        @NotBlank @Size(max = 255) String planName
) {
}
