package com.db.kiragateway.dashboard.dto;

import java.util.List;

public record DashboardResponse(
        String username,
        String role,
        DashboardFinanceDto finance,
        DashboardSoccerDto soccer,
        List<DashboardProfitPointDto> profitChart,
        List<DashboardActivityItemDto> recentActivity
) {
}
