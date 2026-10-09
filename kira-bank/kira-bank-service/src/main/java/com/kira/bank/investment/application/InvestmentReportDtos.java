package com.kira.bank.investment.application;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public final class InvestmentReportDtos {
    private InvestmentReportDtos() {
    }

    /** Net = withdrawals - deposits (matches the statistics page default); netWithBonus adds bonuses. */
    public record Totals(long count, BigDecimal deposits, BigDecimal withdrawals, BigDecimal bonuses,
                         BigDecimal net, BigDecimal netWithBonus) {
    }

    public record Report<T>(String type, LocalDate fromDate, LocalDate toDate, String timeZone, Long accountId,
                            List<CurrencyReport<T>> currencies) {
    }

    public record CurrencyReport<T>(String currency, T data) {
    }

    public record PeriodRow(String period, LocalDate start, Totals totals, BigDecimal cumulativeNet,
                            BigDecimal netChange, BigDecimal netChangePct) {
    }

    public record PeriodicReport(String granularity, Totals totals, BigDecimal averageNet, PeriodRow best,
                                 PeriodRow worst, long profitablePeriods, long losingPeriods, List<PeriodRow> rows) {
    }

    public record AccountRow(Long accountId, String accountName, Totals totals, BigDecimal roiPct,
                             BigDecimal averageDeposit, BigDecimal averageWithdrawal, LocalDate firstDate,
                             LocalDate lastDate, long daysSinceLast, BigDecimal netSharePct) {
    }

    public record AccountsReport(Totals totals, List<AccountRow> rows) {
    }

    public record EquityPoint(LocalDate date, BigDecimal net, BigDecimal cumulativeNet, BigDecimal peak,
                              BigDecimal drawdown) {
    }

    public record DayNet(LocalDate date, BigDecimal net) {
    }

    public record EquityReport(List<EquityPoint> points, BigDecimal finalNet, BigDecimal peakNet,
                               BigDecimal maxDrawdown, LocalDate maxDrawdownDate, BigDecimal currentDrawdown,
                               DayNet bestDay, DayNet worstDay, long activeDays, long winDays, long lossDays,
                               long longestWinStreak, long longestLossStreak, long currentStreak) {
    }

    public record Slot(int key, Totals totals) {
    }

    public record ActivityReport(List<Slot> byWeekday, List<Slot> byHour, List<Slot> byDayOfMonth, int[][] matrix, int busiestWeekday,
                                 int busiestHour, int busiestDayOfMonth) {
    }

    public record TypeStats(String type, long count, BigDecimal total, BigDecimal min, BigDecimal max,
                            BigDecimal average, BigDecimal median, BigDecimal p90) {
    }

    public record SizeBucket(BigDecimal from, BigDecimal to, long deposits, long withdrawals, long bonuses) {
    }

    public record TopTransaction(String accountName, String type, BigDecimal amount, java.time.OffsetDateTime at) {
    }

    public record DistributionReport(List<TypeStats> byType, List<SizeBucket> buckets, List<TopTransaction> largest) {
    }

    public record MetricDelta(String metric, BigDecimal current, BigDecimal previous, BigDecimal change,
                              BigDecimal changePct) {
    }

    public record ComparisonReport(LocalDate previousFrom, LocalDate previousTo, Totals current, Totals previous,
                                   List<MetricDelta> deltas) {
    }

    public record DayRow(LocalDate date, Totals totals) {
    }

    public record DailyReport(Totals totals, List<DayRow> days, DayRow best, DayRow worst, BigDecimal averageNetPerActiveDay,
                              BigDecimal averageTransactionsPerActiveDay) {
    }

    public record RollingPoint(LocalDate date, BigDecimal net, BigDecimal rolling7, BigDecimal rolling30) {
    }

    public record RollingReport(List<RollingPoint> points, BigDecimal latest7, BigDecimal latest30, BigDecimal best7,
                                BigDecimal worst7, BigDecimal averageDailyNet, BigDecimal volatility) {
    }

    public record BonusRow(String key, String label, BigDecimal bonuses, BigDecimal deposits, BigDecimal bonusPctOfDeposits,
                           long bonusCount) {
    }

    public record BonusReport(BigDecimal totalBonuses, BigDecimal totalDeposits, BigDecimal bonusPctOfDeposits,
                              BigDecimal bonusPctOfPositiveNet, BigDecimal averageBonus, BigDecimal largestBonus,
                              List<BonusRow> byMonth, List<BonusRow> byAccount) {
    }

    public record PaybackRow(Long accountId, String accountName, BigDecimal deposits, BigDecimal withdrawals,
                             BigDecimal recoveredPct, BigDecimal outstanding, boolean brokeEven, LocalDate firstDate,
                             LocalDate breakEvenDate, Long daysToBreakEven) {
    }

    public record PaybackReport(BigDecimal deposits, BigDecimal withdrawals, BigDecimal recoveredPct,
                                BigDecimal outstanding, long accountsBrokeEven, long accountsOutstanding,
                                List<PaybackRow> rows) {
    }

    public record SeasonalMonth(int month, long occurrences, long winningOccurrences, long count, BigDecimal totalNet,
                                BigDecimal averageNet) {
    }

    public record SeasonalityReport(List<SeasonalMonth> months, SeasonalMonth best, SeasonalMonth worst) {
    }

    public record ProjectionReport(LocalDate asOf, BigDecimal monthToDateNet, int daysElapsed, int daysRemaining,
                                   BigDecimal dailyRunRate30, BigDecimal projectedMonthEnd, BigDecimal projectedNext30,
                                   BigDecimal projectedYear, BigDecimal trailing30, BigDecimal trailing90,
                                   long observedDays) {
    }

    public record LedgerRow(java.time.OffsetDateTime at, Long accountId, String accountName, String type,
                            BigDecimal amount, BigDecimal signedNet, BigDecimal runningNet) {
    }

    /** Newest first; running net is computed over the whole range before the row cap is applied. */
    public record LedgerReport(Totals totals, boolean truncated, int limit, List<LedgerRow> rows) {
    }

    public record AccountBrief(Long accountId, String accountName, BigDecimal net) {
    }

    public record OverviewReport(Totals totals, long activeAccounts, long activeDays, LocalDate firstDate, LocalDate lastDate,
                                 java.time.OffsetDateTime lastAt, BigDecimal averageTransaction, BigDecimal withdrawalToDepositPct,
                                 AccountBrief bestAccount, AccountBrief worstAccount, String currentMonth,
                                 BigDecimal currentMonthNet, BigDecimal previousMonthNet, BigDecimal monthNetChange) {
    }

    public record MatrixRow(Long accountId, String accountName, List<BigDecimal> cells, List<BigDecimal> cumulative, BigDecimal total) {
    }

    public record MatrixReport(List<String> months, List<MatrixRow> rows, List<BigDecimal> monthTotals, List<BigDecimal> cumulativeTotals) {
    }

    public record DrawdownEpisode(LocalDate peakDate, LocalDate startDate, LocalDate troughDate, LocalDate recoveryDate,
                                  BigDecimal depth, long daysToTrough, Long daysToRecover, long durationDays) {
    }

    public record DrawdownReport(List<DrawdownEpisode> episodes, long count, boolean ongoing, long longestDays,
                                 BigDecimal deepest) {
    }

    public record CadenceRow(Long accountId, String accountName, long transactions, BigDecimal averageGapDays,
                             long longestGapDays, LocalDate longestGapFrom, LocalDate longestGapTo,
                             BigDecimal avgDaysDepositToWithdrawal) {
    }

    public record CadenceReport(BigDecimal averageGapDays, BigDecimal avgDaysDepositToWithdrawal, List<CadenceRow> rows) {
    }

    public record Goal(Long id, String currency, String period, BigDecimal targetAmount) {
    }

    public record GoalProgress(Long id, String period, BigDecimal target, BigDecimal achieved, BigDecimal remaining,
                               BigDecimal pct, BigDecimal elapsedPct, boolean onTrack, boolean reached,
                               BigDecimal requiredDaily, int daysRemaining) {
    }

    public record GoalsReport(LocalDate asOf, List<GoalProgress> goals) {
    }

    public record GoalRequest(@jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Pattern(regexp = "[A-Za-z]{3}") String currency,
                              @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Pattern(regexp = "MONTH|YEAR") String period,
                              @jakarta.validation.constraints.NotNull @jakarta.validation.constraints.DecimalMin(value = "0", inclusive = false)
                              @jakarta.validation.constraints.Digits(integer = 15, fraction = 4) BigDecimal targetAmount) {
    }

    public record Insight(String code, String severity, Long accountId, String accountName, BigDecimal value, LocalDate date) {
    }

    public record InsightsReport(LocalDate asOf, List<Insight> insights) {
    }

    public record PerformanceReport(long activeDays, long winDays, long lossDays, BigDecimal winRatePct, BigDecimal grossWin,
                                    BigDecimal grossLoss, BigDecimal averageWin, BigDecimal averageLoss, BigDecimal payoffRatio,
                                    BigDecimal profitFactor, BigDecimal expectancyPerDay, BigDecimal medianDayNet,
                                    BigDecimal largestWin, BigDecimal largestLoss, BigDecimal totalNet, BigDecimal maxDrawdown,
                                    BigDecimal recoveryFactor) {
    }

    public record Lot(Long accountId, String accountName, LocalDate depositDate, BigDecimal amount, BigDecimal recovered,
                      BigDecimal outstanding, LocalDate recoveredDate, Long daysToRecover, long ageDays) {
    }

    public record AgingBucket(String bucket, long lots, BigDecimal outstanding) {
    }

    public record LotsReport(long lotCount, long recoveredLots, BigDecimal averageDaysToRecover, BigDecimal totalDeposited,
                             BigDecimal totalRecovered, BigDecimal outstanding, List<AgingBucket> aging, boolean truncated,
                             List<Lot> lots) {
    }

    public record AllocationRow(Long accountId, String accountName, BigDecimal deposits, BigDecimal withdrawals, BigDecimal outstanding,
                                BigDecimal outstandingSharePct, BigDecimal depositSharePct) {
    }

    /** hhi is the Herfindahl-Hirschman index of outstanding-capital shares (0-10000); null when nothing is outstanding. */
    public record AllocationReport(BigDecimal totalDeposits, BigDecimal totalOutstanding, BigDecimal hhi, String concentration,
                                   BigDecimal topSharePct, List<AllocationRow> rows) {
    }
}
