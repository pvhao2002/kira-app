package com.db.kiragateway.dashboard.dto;

import java.math.BigDecimal;
import java.util.List;

public record DashboardFinanceDto(
        BigDecimal totalOutstandingBalance,
        long activeCardCount,
        BigDecimal totalCreditLimit,
        int utilizationPercent,
        String nextDueLabel,
        long daysUntilDue,
        List<DashboardCardHighlightDto> cardHighlights
) {
}
