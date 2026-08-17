package com.kira.bank.dashboard.application;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import static com.kira.bank.dashboard.application.DashboardSummaryDtos.DashboardSummaryResponse;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DashboardSummaryService {
    private final DashboardSummaryQuery summaryQuery;

    public DashboardSummaryResponse summary(Long userId) {
        return new DashboardSummaryResponse(
            summaryQuery.creditCardSummary(userId),
            summaryQuery.investmentSummary(userId)
        );
    }
}
