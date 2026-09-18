package com.kira.bank.dashboard.application;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public final class OverviewDtos {
    private OverviewDtos() {
    }

    public record Group<T>(long total, List<T> items) {
    }

    public record Due(Long id, Long cardId, String bankName, String nickname, String lastFour,
                      LocalDate dueDate, BigDecimal remainingAmount, String currency) {
    }

    public record CreditSummary(BigDecimal totalCreditLimit, BigDecimal currentBalance, BigDecimal availableCredit,
                                BigDecimal utilizationRate, String currency, int bankCount, int cardCount) {
    }

    public record Credit(Instant updatedAt, CreditSummary summary,
                         Group<Due> overdue, Group<Due> dueToday, Group<Due> dueSoon, Group<Due> needsInput) {
    }

    public record ImportTask(String batchId, Long accountId, String accountName, String status) {
    }

    public record DailyFlow(LocalDate date, BigDecimal deposits, BigDecimal withdrawals, BigDecimal bonuses) {
    }

    public record CurrencyFlow(String currency, BigDecimal deposits, BigDecimal withdrawals,
                               BigDecimal bonuses, BigDecimal netDeposits, List<DailyFlow> daily) {
    }

    public record Investments(Instant updatedAt, int days, LocalDate fromDate, LocalDate toDate,
                              long activeAccounts, List<CurrencyFlow> currencies,
                              Group<ImportTask> review, Group<ImportTask> failed) {
    }

    public record Lesson(Long seriesId, LocalDate date, LocalTime startTime, LocalTime endTime,
                         String studentName, String subject, BigDecimal fee) {
    }

    public record Conflict(LocalDate date, LocalTime startTime, String description) {
    }

    public record Tutoring(Instant updatedAt, LocalDate weekStart, LocalDate weekEnd, int lessonCount,
                           BigDecimal totalHours, BigDecimal totalFee, Group<Lesson> upcoming,
                           Group<Conflict> conflicts) {
    }
}
