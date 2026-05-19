package com.db.kiragateway.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record GeminiWebsiteCrawlRequest(
        @NotBlank(message = "url is required")
        @Size(max = 2048, message = "url must be <= 2048 characters")
        String url,
        @Size(max = 16000, message = "prompt must be <= 16000 characters")
        String prompt
) {
}
