package com.kira.bank.investment.application;

import com.kira.bank.investment.domain.InvestmentTransactionStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Instant;
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

    public record OverviewResponse(
        Instant updatedAt, String timeZone, Long accountId, LocalDate fromDate, LocalDate toDate,
        List<CurrencySummary> currencies, List<AccountSummary> accounts
    ) {
    }

    public record CurrencySummary(
        String currency, long totalCount, BigDecimal deposits, BigDecimal withdrawals,
        BigDecimal bonuses, BigDecimal netAmount, List<DailyFlow> daily
    ) {
    }

    public record AccountSummary(
        Long accountId, String accountName, String accountCode, String currency, String status,
        long totalCount, BigDecimal deposits, BigDecimal withdrawals, BigDecimal bonuses, BigDecimal netAmount
    ) {
    }

    public record OperationsResponse(
        Instant updatedAt, Long accountId, AiSummary ai, ImportSummary imports, ReconciliationSummary reconciliation
    ) {
    }

    public record AiSummary(long pending, long processing, long ready, long failed) {
    }

    public record ImportSummary(long total, List<ImportItem> items) {
    }

    public record ImportItem(String batchId, Long accountId, String accountName, String status,
                             Instant createdAt, int reviewCount) {
    }

    public record ReconciliationSummary(long total, long open, long inReview, long needsInfo,
                                        List<ReconciliationItem> items) {
    }

    public record ReconciliationItem(Long id, Long accountId, String accountName, Long transactionId,
                                     BigDecimal amount, String currency, String reason, String status,
                                     Instant createdAt) {
    }
}
