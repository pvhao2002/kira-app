package com.db.kiragateway.dto;

import java.time.LocalDateTime;
import java.util.List;

public record GenerateBlogResponse(
        String status,
        String model,
        GenerateBlogData data
) {
    public record GenerateBlogData(
            long blogId,
            String topic,
            String slug,
            String title,
            String excerpt,
            List<String> tags,
            String htmlContent,
            String layoutVariant,
            String status,
            LocalDateTime publishedAt,
            LocalDateTime createdAt
    ) {
    }
}
