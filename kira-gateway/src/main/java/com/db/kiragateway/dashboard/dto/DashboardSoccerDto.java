package com.db.kiragateway.dashboard.dto;

import java.math.BigDecimal;

public record DashboardSoccerDto(
        long trackedMatchCount,
        long trackedThisWeek,
        int winRatePercent,
        BigDecimal netProfit,
        long wins,
        long losses
) {
}
