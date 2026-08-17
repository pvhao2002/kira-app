package com.kira.bank.dashboard.application;

import java.math.BigDecimal;

public final class DashboardSummaryDtos {
    private DashboardSummaryDtos() {
    }

    public record DashboardSummaryResponse(
        CreditCardSummaryResponse creditCard,
        InvestmentSummaryResponse investment
    ) {
    }

    public record CreditCardSummaryResponse(
        BigDecimal totalSpending,
        BigDecimal statementDebt,
        BigDecimal cashbackWaiting,
        BigDecimal cashbackReceived,
        BigDecimal discountProfit
    ) {
    }

    public record InvestmentSummaryResponse(
        BigDecimal currentBalance,
        BigDecimal availableCapital,
        BigDecimal lockedCapital,
        BigDecimal profit,
        BigDecimal reward,
        BigDecimal pendingWithdrawal
    ) {
    }
}
