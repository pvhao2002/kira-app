package com.db.kiragateway.dashboard.dto;

import java.math.BigDecimal;

public record DashboardProfitPointDto(
        String label,
        String date,
        BigDecimal amount
) {
}
