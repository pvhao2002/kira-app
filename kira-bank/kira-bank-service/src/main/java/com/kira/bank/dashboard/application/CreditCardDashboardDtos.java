package com.kira.bank.dashboard.application;

import java.math.BigDecimal;
import java.util.List;

public final class CreditCardDashboardDtos {
    private CreditCardDashboardDtos() {
    }

    public record CreditCardDashboardResponse(BigDecimal totalCreditLimit,
                                              BigDecimal totalStatementDebt,
                                              BigDecimal currentBalance,
                                              BigDecimal availableCredit,
                                              BigDecimal utilizationRate,
                                              String currency,
                                              List<BankDebtResponse> banks) {
    }

    public record BankDebtResponse(Long bankId,
                                   String bankName,
                                   String bankLogoUrl,
                                   int cardCount,
                                   BigDecimal totalCreditLimit,
                                   long creditLimitVersion,
                                   long balanceVersion,
                                   BigDecimal statementDebt,
                                   BigDecimal currentBalance,
                                   BigDecimal availableCredit,
                                   BigDecimal utilizationRate,
                                   String currency,
                                   List<CardDebtResponse> cards) {
    }

    public record CardDebtResponse(Long id,
                                   String nickname,
                                   String lastFour,
                                   String status,
                                   BigDecimal statementDebt,
                                   String currency) {
    }
}
