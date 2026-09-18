package com.kira.bank.investment.application;

import com.kira.bank.investment.domain.InvestmentTransactionStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public final class InvestmentStatisticsDtos {
    private InvestmentStatisticsDtos() {
    }

    public record StatisticsResponse(
        Long accountId,
        String currency,
        LocalDate fromDate,
        LocalDate toDate,
        InvestmentTransactionStatus status,
        long totalCount,
        BigDecimal totalAmount,
        BigDecimal netAmount,
        List<InvestmentTypeSummary> byType,
        List<DailyFlow> daily
    ) {
    }

    public record DailyFlow(LocalDate date, BigDecimal deposits, BigDecimal withdrawals, BigDecimal bonuses) {
    }
}
