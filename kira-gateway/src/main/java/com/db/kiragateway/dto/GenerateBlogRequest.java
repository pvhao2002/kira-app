package com.db.kiragateway.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record GenerateBlogRequest(
        @NotBlank(message = "topic is required")
        @Size(max = 255, message = "topic must be <= 255 characters")
        String topic,
        @Size(max = 100, message = "tone must be <= 100 characters")
        String tone,
        @Size(max = 100, message = "targetAudience must be <= 100 characters")
        String targetAudience,
        @Min(value = 300, message = "minWords must be >= 300")
        @Max(value = 5000, message = "minWords must be <= 5000")
        Integer minWords,
        @Min(value = 300, message = "maxWords must be >= 300")
        @Max(value = 5000, message = "maxWords must be <= 5000")
        Integer maxWords,
        @Size(max = 100, message = "createdBy must be <= 100 characters")
        String createdBy,
        Boolean publishNow
) {
}
