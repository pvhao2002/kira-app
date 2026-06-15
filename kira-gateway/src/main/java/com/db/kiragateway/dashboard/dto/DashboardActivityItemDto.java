package com.db.kiragateway.dashboard.dto;

import java.math.BigDecimal;

public record DashboardActivityItemDto(
        String type,
        String title,
        String subtitle,
        BigDecimal amount,
        String occurredAt,
        boolean positive
) {
}
