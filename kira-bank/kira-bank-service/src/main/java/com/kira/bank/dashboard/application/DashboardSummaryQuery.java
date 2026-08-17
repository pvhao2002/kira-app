package com.kira.bank.dashboard.application;

import static com.kira.bank.dashboard.application.DashboardSummaryDtos.CreditCardSummaryResponse;
import static com.kira.bank.dashboard.application.DashboardSummaryDtos.InvestmentSummaryResponse;

public interface DashboardSummaryQuery {
    CreditCardSummaryResponse creditCardSummary(Long userId);

    InvestmentSummaryResponse investmentSummary(Long userId);
}
