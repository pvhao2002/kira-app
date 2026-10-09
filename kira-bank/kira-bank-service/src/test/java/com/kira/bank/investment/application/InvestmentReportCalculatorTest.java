package com.kira.bank.investment.application;

import com.kira.bank.investment.application.InvestmentReportCalculator.Kind;
import com.kira.bank.investment.application.InvestmentReportCalculator.Tx;
import com.kira.bank.investment.application.InvestmentReportDtos.PeriodicReport;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class InvestmentReportCalculatorTest {
    static final ZoneId Z = ZoneId.of("Asia/Ho_Chi_Minh");

    static Tx tx(Kind k, String amount, String iso) {
        return new Tx(1L, "A", "VND", k, new BigDecimal(amount), ZonedDateTime.parse(iso + "[Asia/Ho_Chi_Minh]"));
    }

    @Test
    void periodicMonthlyAccumulatesAndComparesNet() {
        List<Tx> txs = List.of(
            tx(Kind.DEPOSIT, "1000", "2026-01-05T10:00:00+07:00"),
            tx(Kind.WITHDRAWAL, "400", "2026-01-20T10:00:00+07:00"),
            tx(Kind.DEPOSIT, "100", "2026-03-01T10:00:00+07:00"),
            tx(Kind.WITHDRAWAL, "1500", "2026-03-02T10:00:00+07:00"),
            tx(Kind.BONUS, "50", "2026-03-02T11:00:00+07:00"));
        PeriodicReport r = InvestmentReportCalculator.periodic(txs, "MONTH", java.time.LocalDate.of(2026, 1, 1), java.time.LocalDate.of(2026, 3, 31));
        assertEquals(3, r.rows().size()); // the empty February is a real (flat) period
        assertEquals("2026-01", r.rows().get(0).period());
        assertEquals(0, new BigDecimal("-600").compareTo(r.rows().get(0).totals().net()));
        eq("0", r.rows().get(1).totals().net());
        assertEquals(0L, r.rows().get(1).totals().count());
        assertEquals(0, new BigDecimal("1400").compareTo(r.rows().get(2).totals().net()));
        assertEquals(0, new BigDecimal("800").compareTo(r.rows().get(2).cumulativeNet()));
        assertEquals(0, new BigDecimal("600").compareTo(r.rows().get(1).netChange())); // Feb vs Jan, adjacent periods
        assertNull(r.rows().get(2).netChangePct()); // March vs a zero February: no baseline
        eq("266.6667", r.averageNet()); // 800 over 3 months, not 2
        assertEquals(1, r.profitablePeriods());
        assertEquals(1, r.losingPeriods());
        assertEquals("2026-03", r.best().period());
        assertEquals(0, new BigDecimal("1450").compareTo(r.rows().get(2).totals().netWithBonus()));
    }

    @Test
    void bucketsWeeksOnMondayAndQuarters() {
        assertEquals("2026-10-05", InvestmentReportCalculator.bucketStart(java.time.LocalDate.of(2026, 10, 9), "WEEK").toString());
        assertEquals("2026-10-01", InvestmentReportCalculator.bucketStart(java.time.LocalDate.of(2026, 11, 9), "QUARTER").toString());
        assertEquals(2, InvestmentReportCalculator.periodic(List.of(), "MONTH", java.time.LocalDate.of(2026, 1, 15), java.time.LocalDate.of(2026, 2, 3)).rows().size());
        assertNull(InvestmentReportCalculator.periodic(List.of(), "MONTH", java.time.LocalDate.of(2026, 1, 15), java.time.LocalDate.of(2026, 2, 3)).best());
    }

    static Tx acc(long id, Kind k, String amount, String iso) {
        return new Tx(id, "A" + id, "VND", k, new BigDecimal(amount), ZonedDateTime.parse(iso + "[Asia/Ho_Chi_Minh]"));
    }

    static void eq(String expected, BigDecimal actual) {
        assertEquals(0, new BigDecimal(expected).compareTo(actual), "expected " + expected + " got " + actual);
    }

    @Test
    void accountsRankedByNetWithRoiAndInactivity() {
        var r = InvestmentReportCalculator.accounts(List.of(
            acc(1, Kind.DEPOSIT, "1000", "2026-01-05T10:00:00+07:00"), acc(1, Kind.WITHDRAWAL, "1500", "2026-01-10T10:00:00+07:00"),
            acc(2, Kind.DEPOSIT, "500", "2026-01-06T10:00:00+07:00")), java.time.LocalDate.of(2026, 1, 20));
        assertEquals(2, r.rows().size());
        assertEquals("A1", r.rows().get(0).accountName());
        eq("50.00", r.rows().get(0).roiPct());
        eq("-100.00", r.rows().get(1).roiPct());
        assertEquals(10, r.rows().get(0).daysSinceLast());
        eq("1000", r.rows().get(0).averageDeposit());
        assertNull(r.rows().get(0).netSharePct()); // total net is 0 -> no share
    }

    @Test
    void equityTracksDrawdownAndStreaks() {
        var r = InvestmentReportCalculator.equity(List.of(
            acc(1, Kind.WITHDRAWAL, "100", "2026-01-01T10:00:00+07:00"), acc(1, Kind.WITHDRAWAL, "50", "2026-01-02T10:00:00+07:00"),
            acc(1, Kind.DEPOSIT, "200", "2026-01-03T10:00:00+07:00"), acc(1, Kind.DEPOSIT, "10", "2026-01-04T10:00:00+07:00")),
            java.time.LocalDate.of(2026, 1, 1), java.time.LocalDate.of(2026, 1, 5));
        assertEquals(5, r.points().size());
        eq("-60", r.finalNet());
        eq("150", r.peakNet());
        eq("210", r.maxDrawdown());
        assertEquals(java.time.LocalDate.of(2026, 1, 4), r.maxDrawdownDate());
        eq("210", r.currentDrawdown());
        assertEquals(2, r.winDays());
        assertEquals(2, r.lossDays());
        assertEquals(2, r.longestWinStreak());
        assertEquals(2, r.longestLossStreak());
        assertEquals(-2, r.currentStreak());
        eq("100", r.bestDay().net());
        eq("-200", r.worstDay().net());
    }

    @Test
    void activityBucketsByWeekdayAndHour() {
        var r = InvestmentReportCalculator.activity(List.of(
            acc(1, Kind.DEPOSIT, "10", "2026-10-05T09:15:00+07:00"), acc(1, Kind.DEPOSIT, "10", "2026-10-12T09:45:00+07:00"),
            acc(1, Kind.WITHDRAWAL, "5", "2026-10-09T21:00:00+07:00")));
        assertEquals(1, r.busiestWeekday()); // both Mondays
        assertEquals(9, r.busiestHour());
        assertEquals(2, r.matrix()[0][9]);
        assertEquals(1, r.matrix()[4][21]);
        assertEquals(7, r.byWeekday().size());
        assertEquals(24, r.byHour().size());
        assertEquals(31, r.byDayOfMonth().size());
        assertEquals(1, r.byDayOfMonth().get(8).key() - 8); // key is the calendar day (1-based)
        assertEquals(1L, r.byDayOfMonth().get(11).totals().count()); // 12th
        assertEquals(5, r.busiestDayOfMonth()); // 5th, 9th and 12th tie with one each -> earliest day wins
    }

    @Test
    void distributionStatsBucketsAndTop() {
        var r = InvestmentReportCalculator.distribution(List.of(
            acc(1, Kind.DEPOSIT, "100", "2026-01-01T10:00:00+07:00"), acc(1, Kind.DEPOSIT, "300", "2026-01-02T10:00:00+07:00"),
            acc(1, Kind.DEPOSIT, "200", "2026-01-03T10:00:00+07:00"), acc(1, Kind.WITHDRAWAL, "900", "2026-01-04T10:00:00+07:00")));
        var dep = r.byType().get(0);
        assertEquals("DEPOSIT", dep.type());
        eq("200", dep.median());
        eq("300", dep.p90());
        eq("200", dep.average());
        assertEquals(8, r.buckets().size());
        assertEquals(4, r.buckets().stream().mapToLong(b -> b.deposits() + b.withdrawals() + b.bonuses()).sum());
        eq("900", r.largest().get(0).amount());
        assertEquals(0, InvestmentReportCalculator.distribution(List.of()).buckets().size());
    }

    @Test
    void comparisonComputesDeltasAndGuardsZeroBaseline() {
        var cur = List.of(acc(1, Kind.WITHDRAWAL, "300", "2026-02-01T10:00:00+07:00"), acc(1, Kind.DEPOSIT, "100", "2026-02-02T10:00:00+07:00"));
        var prev = List.of(acc(1, Kind.WITHDRAWAL, "150", "2026-01-01T10:00:00+07:00"));
        var r = InvestmentReportCalculator.comparison(cur, prev, java.time.LocalDate.of(2026, 1, 1), java.time.LocalDate.of(2026, 1, 31));
        var net = r.deltas().stream().filter(d -> d.metric().equals("NET")).findFirst().get();
        eq("200", net.current());
        eq("150", net.previous());
        eq("33.33", net.changePct());
        var deposits = r.deltas().stream().filter(d -> d.metric().equals("DEPOSITS")).findFirst().get();
        assertNull(deposits.changePct()); // previous = 0 -> no percentage
    }

    @Test
    void dailyAggregatesActiveDays() {
        var r = InvestmentReportCalculator.daily(List.of(
            acc(1, Kind.DEPOSIT, "100", "2026-01-01T10:00:00+07:00"), acc(1, Kind.WITHDRAWAL, "300", "2026-01-01T12:00:00+07:00"),
            acc(1, Kind.DEPOSIT, "50", "2026-01-03T10:00:00+07:00")));
        assertEquals(2, r.days().size());
        eq("200", r.best().totals().net());
        eq("-50", r.worst().totals().net());
        eq("75", r.averageNetPerActiveDay());
        eq("1.50", r.averageTransactionsPerActiveDay());
        assertTrue(InvestmentReportCalculator.daily(List.of()).days().isEmpty());
    }

    @Test
    void rollingWindowsSlideAndVolatilityIsSampleStdDev() {
        var txs = List.of(acc(1, Kind.WITHDRAWAL, "10", "2026-01-01T10:00:00+07:00"), acc(1, Kind.WITHDRAWAL, "30", "2026-01-03T10:00:00+07:00"));
        var r = InvestmentReportCalculator.rolling(txs, java.time.LocalDate.of(2026, 1, 1), java.time.LocalDate.of(2026, 1, 9));
        assertEquals(9, r.points().size());
        eq("40", r.points().get(6).rolling7()); // jan 1..7
        eq("30", r.points().get(7).rolling7()); // jan 1 dropped
        eq("30", r.latest7()); // jan 3..9
        eq("40", r.latest30());
        eq("40", r.best7());
        eq("30", r.worst7());
        // values: 10,0,30,0*6 -> mean 40/9, sample std dev ~ 10.1379
        assertTrue(r.volatility().compareTo(new BigDecimal("10.13")) > 0 && r.volatility().compareTo(new BigDecimal("10.15")) < 0, r.volatility().toString());
    }

    @Test
    void bonusRatesAreGuardedAgainstZeroBaselines() {
        var r = InvestmentReportCalculator.bonus(List.of(
            acc(1, Kind.DEPOSIT, "1000", "2026-01-01T10:00:00+07:00"), acc(1, Kind.BONUS, "100", "2026-01-02T10:00:00+07:00"),
            acc(2, Kind.BONUS, "50", "2026-02-02T10:00:00+07:00")));
        eq("150", r.totalBonuses());
        eq("15.00", r.bonusPctOfDeposits());
        eq("75", r.averageBonus());
        eq("100", r.largestBonus());
        assertNull(r.bonusPctOfPositiveNet()); // net + bonus = -850 -> no positive baseline
        assertEquals(2, r.byMonth().size());
        assertEquals("A1", r.byAccount().get(0).label());
        assertNull(r.byAccount().get(1).bonusPctOfDeposits()); // account 2 never deposited
    }

    @Test
    void paybackFindsBreakEvenDateAndOutstanding() {
        var r = InvestmentReportCalculator.payback(List.of(
            acc(1, Kind.DEPOSIT, "1000", "2026-01-01T10:00:00+07:00"), acc(1, Kind.WITHDRAWAL, "400", "2026-01-10T10:00:00+07:00"),
            acc(1, Kind.WITHDRAWAL, "700", "2026-01-21T10:00:00+07:00"),
            acc(2, Kind.DEPOSIT, "500", "2026-01-05T10:00:00+07:00"), acc(2, Kind.WITHDRAWAL, "100", "2026-01-06T10:00:00+07:00")));
        var a1 = r.rows().stream().filter(x -> x.accountId() == 1).findFirst().get();
        assertTrue(a1.brokeEven());
        assertEquals(java.time.LocalDate.of(2026, 1, 21), a1.breakEvenDate());
        assertEquals(20L, a1.daysToBreakEven());
        eq("110.00", a1.recoveredPct());
        eq("-100", a1.outstanding());
        var a2 = r.rows().stream().filter(x -> x.accountId() == 2).findFirst().get();
        assertFalse(a2.brokeEven());
        assertNull(a2.breakEvenDate());
        assertEquals(2, r.rows().size());
        assertEquals(2L, r.rows().get(0).accountId()); // largest outstanding first
        assertEquals(1, r.accountsBrokeEven());
        assertEquals(1, r.accountsOutstanding());
        eq("1500", r.deposits());
        assertNull(InvestmentReportCalculator.payback(List.of(acc(1, Kind.BONUS, "5", "2026-01-01T10:00:00+07:00"))).recoveredPct());
        // break-even is a current state: new deposits after recovering put the account back to outstanding
        var relapse = InvestmentReportCalculator.payback(List.of(
            acc(3, Kind.DEPOSIT, "100", "2026-01-01T10:00:00+07:00"), acc(3, Kind.WITHDRAWAL, "100", "2026-01-02T10:00:00+07:00"),
            acc(3, Kind.BONUS, "50", "2026-01-03T10:00:00+07:00"), acc(3, Kind.DEPOSIT, "5000", "2026-01-04T10:00:00+07:00")));
        assertFalse(relapse.rows().get(0).brokeEven());
        assertNull(relapse.rows().get(0).breakEvenDate());
        assertEquals(0, relapse.accountsBrokeEven());
        assertEquals(1, relapse.accountsOutstanding());
        // a bonus alone never creates a break-even date; it stays at the withdrawal that covered the deposits
        var steady = InvestmentReportCalculator.payback(List.of(
            acc(4, Kind.DEPOSIT, "100", "2026-01-01T10:00:00+07:00"), acc(4, Kind.WITHDRAWAL, "100", "2026-01-02T10:00:00+07:00"),
            acc(4, Kind.BONUS, "50", "2026-01-09T10:00:00+07:00")));
        assertEquals(java.time.LocalDate.of(2026, 1, 2), steady.rows().get(0).breakEvenDate());
    }

    @Test
    void seasonalityAveragesPerYearMonthOccurrence() {
        var r = InvestmentReportCalculator.seasonality(List.of(
            acc(1, Kind.WITHDRAWAL, "300", "2025-03-05T10:00:00+07:00"), acc(1, Kind.WITHDRAWAL, "100", "2026-03-05T10:00:00+07:00"),
            acc(1, Kind.DEPOSIT, "50", "2026-03-06T10:00:00+07:00"), acc(1, Kind.DEPOSIT, "200", "2026-07-01T10:00:00+07:00")));
        assertEquals(12, r.months().size());
        var march = r.months().get(2);
        assertEquals(2, march.occurrences());
        assertEquals(2, march.winningOccurrences());
        eq("350", march.totalNet());
        eq("175", march.averageNet());
        assertEquals(3, r.best().month());
        assertEquals(7, r.worst().month());
        assertEquals(0, r.months().get(0).occurrences());
    }

    @Test
    void projectionExtendsTrailingRunRateOverRemainingDays() {
        var asOf = java.time.LocalDate.of(2026, 6, 10); // 20 days left in June
        var r = InvestmentReportCalculator.projection(List.of(
            acc(1, Kind.WITHDRAWAL, "600", "2026-06-02T10:00:00+07:00"), acc(1, Kind.DEPOSIT, "300", "2026-05-20T10:00:00+07:00"),
            acc(1, Kind.WITHDRAWAL, "9999", "2026-06-20T10:00:00+07:00")), asOf, java.time.LocalDate.of(2026, 3, 1)); // first-ever transaction long ago
        eq("600", r.monthToDateNet());
        eq("300", r.trailing30()); // May 20 .. Jun 10: +600 -300; future tx ignored
        assertEquals(20, r.daysRemaining());
        eq("10.0000", r.dailyRunRate30());
        eq("800", r.projectedMonthEnd()); // 600 + 10*20
        eq("300", r.projectedNext30());
        eq("3650", r.projectedYear());
        assertEquals(30, r.observedDays());
        // range shorter than 30 days -> divide by observed days only
        assertEquals(5, InvestmentReportCalculator.projection(List.of(), asOf, asOf.minusDays(4)).observedDays()); // history shorter than 30 days
        assertEquals(1, InvestmentReportCalculator.projection(List.of(), asOf, null).observedDays()); // no history at all
    }

    @Test
    void ledgerRunsBalanceOldestFirstButReturnsNewestFirstAndCaps() {
        var r = InvestmentReportCalculator.ledger(List.of(
            acc(1, Kind.DEPOSIT, "100", "2026-01-01T10:00:00+07:00"), acc(1, Kind.WITHDRAWAL, "250", "2026-01-02T10:00:00+07:00"),
            acc(1, Kind.BONUS, "10", "2026-01-03T10:00:00+07:00")));
        assertEquals(3, r.rows().size());
        assertEquals("BONUS", r.rows().get(0).type());
        eq("150", r.rows().get(0).runningNet()); // bonus does not move the net
        eq("-100", r.rows().get(2).runningNet());
        eq("0", r.rows().get(0).signedNet());
        assertFalse(r.truncated());
        var many = new java.util.ArrayList<Tx>();
        for (int i = 0; i < InvestmentReportCalculator.LEDGER_LIMIT + 5; i++) many.add(acc(1, Kind.WITHDRAWAL, "1", "2026-01-01T10:00:00+07:00"));
        var capped = InvestmentReportCalculator.ledger(many);
        assertTrue(capped.truncated());
        assertEquals(InvestmentReportCalculator.LEDGER_LIMIT, capped.rows().size());
        eq("1005", capped.rows().get(0).runningNet());
        eq("1005", capped.totals().net());
    }

    @Test
    void overviewSummarisesHeadlinesAndMonthOverMonth() {
        var r = InvestmentReportCalculator.overview(List.of(
            acc(1, Kind.WITHDRAWAL, "300", "2026-05-10T10:00:00+07:00"), acc(1, Kind.DEPOSIT, "100", "2026-06-02T10:00:00+07:00"),
            acc(2, Kind.DEPOSIT, "500", "2026-06-03T10:00:00+07:00"), acc(2, Kind.WITHDRAWAL, "100", "2026-06-04T10:00:00+07:00")),
            java.time.LocalDate.of(2026, 6, 10));
        assertEquals(2, r.activeAccounts());
        assertEquals(4, r.activeDays());
        assertEquals("2026-06", r.currentMonth());
        eq("-500", r.currentMonthNet());
        eq("300", r.previousMonthNet());
        eq("-800", r.monthNetChange());
        assertEquals(1L, r.bestAccount().accountId());
        eq("200", r.bestAccount().net());
        assertEquals(2L, r.worstAccount().accountId());
        eq("66.67", r.withdrawalToDepositPct());
        eq("250", r.averageTransaction());
        assertEquals(java.time.LocalDate.of(2026, 6, 4), r.lastDate());
        assertNull(InvestmentReportCalculator.overview(List.of(), java.time.LocalDate.of(2026, 6, 10)).bestAccount());
    }

    @Test
    void matrixPivotsAccountsByMonthWithTotals() {
        var r = InvestmentReportCalculator.matrix(List.of(
            acc(1, Kind.WITHDRAWAL, "300", "2026-01-10T10:00:00+07:00"), acc(1, Kind.DEPOSIT, "100", "2026-03-02T10:00:00+07:00"),
            acc(2, Kind.WITHDRAWAL, "50", "2026-03-04T10:00:00+07:00")), java.time.LocalDate.of(2026, 1, 1), java.time.LocalDate.of(2026, 3, 31));
        assertEquals(java.util.List.of("2026-01", "2026-02", "2026-03"), r.months());
        assertEquals(1L, r.rows().get(0).accountId()); // 200 net beats 50
        eq("300", r.rows().get(0).cells().get(0));
        eq("0", r.rows().get(0).cells().get(1));
        eq("-100", r.rows().get(0).cells().get(2));
        eq("200", r.rows().get(0).total());
        eq("300", r.rows().get(0).cumulative().get(1)); // Jan 300, Feb flat
        eq("200", r.rows().get(0).cumulative().get(2)); // after March -100
        eq("200", r.rows().get(0).cumulative().get(r.months().size() - 1));
        eq("-50", r.monthTotals().get(2));
        eq("300", r.cumulativeTotals().get(0)); // Jan 300
        eq("250", r.cumulativeTotals().get(2)); // 300 + 0 - 50
    }

    @Test
    void drawdownEpisodesTrackPeakTroughAndRecovery() {
        // cum: d1 +100 (peak), d2 -150 => -50 (dd 150), d3 -50 => -100 (dd 200 trough), d4 +250 => 150 (recovered, new peak), d5 -10 => 140 (open)
        var r = InvestmentReportCalculator.drawdowns(List.of(
            acc(1, Kind.WITHDRAWAL, "100", "2026-01-01T10:00:00+07:00"), acc(1, Kind.DEPOSIT, "150", "2026-01-02T10:00:00+07:00"),
            acc(1, Kind.DEPOSIT, "50", "2026-01-03T10:00:00+07:00"), acc(1, Kind.WITHDRAWAL, "250", "2026-01-04T10:00:00+07:00"),
            acc(1, Kind.DEPOSIT, "10", "2026-01-05T10:00:00+07:00")), java.time.LocalDate.of(2026, 1, 1), java.time.LocalDate.of(2026, 1, 6));
        assertEquals(2, r.count());
        assertTrue(r.ongoing());
        var big = r.episodes().get(0);
        eq("200", big.depth());
        assertEquals(java.time.LocalDate.of(2026, 1, 1), big.peakDate());
        assertEquals(java.time.LocalDate.of(2026, 1, 2), big.startDate());
        assertEquals(java.time.LocalDate.of(2026, 1, 3), big.troughDate());
        assertEquals(java.time.LocalDate.of(2026, 1, 4), big.recoveryDate());
        assertEquals(1L, big.daysToTrough());
        assertEquals(1L, big.daysToRecover());
        assertEquals(2L, big.durationDays());
        var open = r.episodes().get(1);
        assertNull(open.recoveryDate());
        eq("10", open.depth());
        assertEquals(2L, open.durationDays()); // Jan 5 and Jan 6 inclusive
        assertEquals(0, InvestmentReportCalculator.drawdowns(List.of(), java.time.LocalDate.of(2026, 1, 1), java.time.LocalDate.of(2026, 1, 5)).count());
    }

    @Test
    void cadenceMeasuresGapsAndDepositToWithdrawalTurnaround() {
        var r = InvestmentReportCalculator.cadence(List.of(
            acc(1, Kind.DEPOSIT, "100", "2026-01-01T10:00:00+07:00"), acc(1, Kind.WITHDRAWAL, "50", "2026-01-05T10:00:00+07:00"),
            acc(1, Kind.WITHDRAWAL, "50", "2026-01-15T10:00:00+07:00"), acc(2, Kind.BONUS, "5", "2026-01-02T10:00:00+07:00")));
        var a1 = r.rows().get(0);
        eq("7.00", a1.averageGapDays()); // gaps 4 and 10
        assertEquals(10L, a1.longestGapDays());
        assertEquals(java.time.LocalDate.of(2026, 1, 5), a1.longestGapFrom());
        eq("9.00", a1.avgDaysDepositToWithdrawal()); // 4 and 14
        assertNull(r.rows().get(1).averageGapDays()); // single transaction
        assertNull(r.rows().get(1).avgDaysDepositToWithdrawal());
        eq("7.00", r.averageGapDays());
    }

    @Test
    void goalsMeasureCalendarPeriodProgressAndPace() {
        var asOf = java.time.LocalDate.of(2026, 6, 10); // 30-day month, 10 elapsed, 20 left
        var txs = List.of(
            acc(1, Kind.WITHDRAWAL, "700", "2026-06-02T10:00:00+07:00"), acc(1, Kind.DEPOSIT, "100", "2026-06-03T10:00:00+07:00"),
            acc(1, Kind.WITHDRAWAL, "400", "2026-02-03T10:00:00+07:00"), acc(1, Kind.WITHDRAWAL, "9999", "2026-06-20T10:00:00+07:00"));
        var r = InvestmentReportCalculator.goals(txs, List.of(
            new InvestmentReportDtos.Goal(1L, "VND", "MONTH", new BigDecimal("1000")),
            new InvestmentReportDtos.Goal(2L, "VND", "YEAR", new BigDecimal("500"))), asOf);
        var month = r.goals().get(0);
        eq("600", month.achieved());
        eq("400", month.remaining());
        eq("60.00", month.pct());
        eq("33.33", month.elapsedPct());
        assertTrue(month.onTrack());
        assertFalse(month.reached());
        eq("20.0000", month.requiredDaily());
        assertEquals(20, month.daysRemaining());
        var year = r.goals().get(1);
        eq("1000", year.achieved()); // Feb + Jun, future tx ignored
        assertTrue(year.reached());
        eq("0", year.remaining());
        eq("200.00", year.pct());
        var behind = InvestmentReportCalculator.goals(List.of(), List.of(new InvestmentReportDtos.Goal(3L, "VND", "MONTH", new BigDecimal("100"))), asOf);
        assertFalse(behind.goals().get(0).onTrack());
        eq("0.00", behind.goals().get(0).pct());
    }

    @Test
    void insightsFlagDormancyStreaksDrawdownAndAnomalies() {
        var asOf = java.time.LocalDate.of(2026, 6, 30);
        var txs = new java.util.ArrayList<Tx>();
        txs.add(acc(2, Kind.DEPOSIT, "10", "2026-04-01T10:00:00+07:00"));                    // account 2 dormant (90d)
        txs.add(acc(1, Kind.WITHDRAWAL, "1000", "2026-06-10T10:00:00+07:00"));                // builds a peak
        for (int d = 26; d <= 28; d++) txs.add(acc(1, Kind.DEPOSIT, "400", "2026-06-" + d + "T10:00:00+07:00")); // 3 losing days
        for (int i = 0; i < 5; i++) txs.add(acc(1, Kind.BONUS, "10", "2026-06-1" + i + "T11:00:00+07:00"));
        txs.add(acc(1, Kind.BONUS, "500", "2026-06-28T11:00:00+07:00"));                     // anomaly: >= 3x avg bonus
        txs.sort(java.util.Comparator.comparing(Tx::at));
        var r = InvestmentReportCalculator.insights(txs, java.time.LocalDate.of(2026, 4, 1), asOf);
        var codes = r.insights().stream().map(i -> i.code()).toList();
        assertTrue(codes.contains("DORMANT_ACCOUNT"));
        assertTrue(codes.contains("LOSING_STREAK"));
        assertTrue(codes.contains("DEEP_DRAWDOWN"));
        assertTrue(codes.contains("NEGATIVE_MONTH"));
        assertTrue(codes.contains("LARGE_TRANSACTION_BONUS"));
        assertFalse(codes.contains("NO_RECENT_ACTIVITY")); // last activity Jun 28
        assertEquals("WARN", r.insights().get(0).severity()); // warnings first
        assertEquals("INFO", r.insights().get(r.insights().size() - 1).severity());
        assertTrue(InvestmentReportCalculator.insights(List.of(), java.time.LocalDate.of(2026, 1, 1), asOf).insights().isEmpty());
    }

    @Test
    void insightsSeeDormancyBeyondTheWindowAndIgnoreStaleStreaks() {
        var asOf = java.time.LocalDate.of(2026, 6, 30);
        var from = asOf.minusDays(89);
        // activity ended 100 days ago: outside the 90-day window but still relevant for dormancy / idleness
        var old = new java.util.ArrayList<Tx>(List.of(
            acc(1, Kind.DEPOSIT, "10", "2026-03-18T10:00:00+07:00"), acc(1, Kind.DEPOSIT, "10", "2026-03-19T10:00:00+07:00"),
            acc(1, Kind.DEPOSIT, "10", "2026-03-20T10:00:00+07:00")));
        var codes = InvestmentReportCalculator.insights(old, from, asOf).insights().stream().map(i -> i.code()).toList();
        assertTrue(codes.contains("DORMANT_ACCOUNT"));
        assertTrue(codes.contains("NO_RECENT_ACTIVITY"));
        assertFalse(codes.contains("LOSING_STREAK")); // three losing days, but none of them recent
        // a streak that ended 10 days ago is stale; one ending yesterday is current
        var stale = new java.util.ArrayList<Tx>(List.of(
            acc(2, Kind.DEPOSIT, "10", "2026-06-18T10:00:00+07:00"), acc(2, Kind.DEPOSIT, "10", "2026-06-19T10:00:00+07:00"), acc(2, Kind.DEPOSIT, "10", "2026-06-20T10:00:00+07:00")));
        assertFalse(InvestmentReportCalculator.insights(stale, from, asOf).insights().stream().anyMatch(i -> i.code().equals("LOSING_STREAK")));
        var fresh = new java.util.ArrayList<Tx>(List.of(
            acc(2, Kind.DEPOSIT, "10", "2026-06-27T10:00:00+07:00"), acc(2, Kind.DEPOSIT, "10", "2026-06-28T10:00:00+07:00"), acc(2, Kind.DEPOSIT, "10", "2026-06-29T10:00:00+07:00")));
        assertTrue(InvestmentReportCalculator.insights(fresh, from, asOf).insights().stream().anyMatch(i -> i.code().equals("LOSING_STREAK")));
    }

    @Test
    void performanceStatsFromDailyNet() {
        // day nets: +300, -100, +100, -300 (+bonus-only day counts as flat)
        var r = InvestmentReportCalculator.performance(List.of(
            acc(1, Kind.WITHDRAWAL, "300", "2026-01-01T10:00:00+07:00"), acc(1, Kind.DEPOSIT, "100", "2026-01-02T10:00:00+07:00"),
            acc(1, Kind.WITHDRAWAL, "100", "2026-01-03T10:00:00+07:00"), acc(1, Kind.DEPOSIT, "300", "2026-01-04T10:00:00+07:00"),
            acc(1, Kind.BONUS, "5", "2026-01-05T10:00:00+07:00")), java.time.LocalDate.of(2026, 1, 1), java.time.LocalDate.of(2026, 1, 5));
        assertEquals(5, r.activeDays());
        assertEquals(2, r.winDays());
        assertEquals(2, r.lossDays());
        eq("50.00", r.winRatePct());
        eq("400", r.grossWin());
        eq("400", r.grossLoss());
        eq("200", r.averageWin());
        eq("200", r.averageLoss());
        eq("1.00", r.payoffRatio());
        eq("1.00", r.profitFactor());
        eq("0", r.totalNet());
        eq("0", r.expectancyPerDay());
        eq("0", r.medianDayNet());
        eq("300", r.largestWin());
        eq("300", r.largestLoss());
        eq("300", r.maxDrawdown()); // 300 -> 200 -> 300 -> 0
        eq("0.00", r.recoveryFactor());
        var none = InvestmentReportCalculator.performance(List.of(acc(1, Kind.WITHDRAWAL, "10", "2026-01-01T10:00:00+07:00")), java.time.LocalDate.of(2026, 1, 1), java.time.LocalDate.of(2026, 1, 1));
        assertNull(none.profitFactor()); // no losing days
        assertNull(none.payoffRatio());
        assertNull(none.recoveryFactor()); // no drawdown
        assertNull(InvestmentReportCalculator.performance(List.of(), java.time.LocalDate.of(2026, 1, 1), java.time.LocalDate.of(2026, 1, 2)).winRatePct());
    }

    /** Randomised cross-checks: independent reports computed from the same data must agree with each other. */
    @Test
    void reportsAgreeWithEachOtherOnRandomData() {
        var rnd = new java.util.Random(7);
        var from = java.time.LocalDate.of(2025, 11, 20);
        var to = java.time.LocalDate.of(2026, 3, 10);
        var txs = new java.util.ArrayList<Tx>();
        Kind[] kinds = Kind.values();
        for (int i = 0; i < 600; i++) {
            var day = from.plusDays(rnd.nextInt((int) java.time.temporal.ChronoUnit.DAYS.between(from, to) + 1));
            txs.add(acc(1 + rnd.nextInt(4), kinds[rnd.nextInt(3)], String.valueOf(1 + rnd.nextInt(5000)),
                day + "T" + String.format("%02d:%02d:00", rnd.nextInt(24), rnd.nextInt(60)) + "+07:00"));
        }
        txs.sort(java.util.Comparator.comparing(Tx::at));
        var total = InvestmentReportCalculator.totals(txs);

        for (String g : List.of("DAY", "WEEK", "MONTH", "QUARTER", "YEAR")) {
            var p = InvestmentReportCalculator.periodic(txs, g, from, to);
            eq(total.net().toPlainString(), p.rows().stream().map(r -> r.totals().net()).reduce(BigDecimal.ZERO, BigDecimal::add));
            eq(total.net().toPlainString(), p.rows().get(p.rows().size() - 1).cumulativeNet());
            assertEquals(total.count(), p.rows().stream().mapToLong(r -> r.totals().count()).sum());
            for (int i = 1; i < p.rows().size(); i++) assertTrue(p.rows().get(i).start().isAfter(p.rows().get(i - 1).start()), g + " buckets must be ordered and unique");
        }
        var eq = InvestmentReportCalculator.equity(txs, from, to);
        eq(total.net().toPlainString(), eq.finalNet());
        var daily = InvestmentReportCalculator.daily(txs);
        eq(total.net().toPlainString(), daily.days().stream().map(d -> d.totals().net()).reduce(BigDecimal.ZERO, BigDecimal::add));
        var rolling = InvestmentReportCalculator.rolling(txs, from, to);
        eq(total.net().toPlainString(), rolling.points().stream().map(p -> p.net()).reduce(BigDecimal.ZERO, BigDecimal::add));
        var performance = InvestmentReportCalculator.performance(txs, from, to);
        eq(total.net().toPlainString(), performance.totalNet());
        eq(eq.maxDrawdown().toPlainString(), performance.maxDrawdown());
        assertEquals(eq.maxDrawdown().compareTo(InvestmentReportCalculator.drawdowns(txs, from, to).deepest()), 0);
        assertEquals(daily.days().size(), performance.activeDays());
        var accounts = InvestmentReportCalculator.accounts(txs, to);
        eq(total.net().toPlainString(), accounts.rows().stream().map(r -> r.totals().net()).reduce(BigDecimal.ZERO, BigDecimal::add));
        var matrix = InvestmentReportCalculator.matrix(txs, from, to);
        eq(total.net().toPlainString(), matrix.monthTotals().stream().reduce(BigDecimal.ZERO, BigDecimal::add));
        eq(total.net().toPlainString(), matrix.rows().stream().map(r -> r.total()).reduce(BigDecimal.ZERO, BigDecimal::add));
        var ledger = InvestmentReportCalculator.ledger(txs);
        eq(total.net().toPlainString(), ledger.rows().get(0).runningNet());
        var dist = InvestmentReportCalculator.distribution(txs);
        assertEquals(total.count(), dist.byType().stream().mapToLong(t -> t.count()).sum());
        assertEquals(total.count(), dist.buckets().stream().mapToLong(b -> b.deposits() + b.withdrawals() + b.bonuses()).sum());
        var activity = InvestmentReportCalculator.activity(txs);
        assertEquals(total.count(), java.util.Arrays.stream(activity.matrix()).flatMapToInt(java.util.Arrays::stream).sum());
        var bonus = InvestmentReportCalculator.bonus(txs);
        eq(total.bonuses().toPlainString(), bonus.totalBonuses());
        eq(total.bonuses().toPlainString(), bonus.byMonth().stream().map(r -> r.bonuses()).reduce(BigDecimal.ZERO, BigDecimal::add));
        var payback = InvestmentReportCalculator.payback(txs);
        eq(total.deposits().toPlainString(), payback.deposits());
        var lots = InvestmentReportCalculator.lots(txs, to);
        eq(total.deposits().toPlainString(), lots.totalDeposited());
        assertTrue(lots.totalRecovered().compareTo(total.withdrawals()) <= 0);
        eq(lots.totalDeposited().subtract(lots.totalRecovered()).toPlainString(), lots.outstanding());
        var allocation = InvestmentReportCalculator.allocation(txs);
        eq(total.deposits().toPlainString(), allocation.totalDeposits());
        assertTrue(allocation.hhi() == null || allocation.hhi().compareTo(BigDecimal.valueOf(10000)) <= 0);
        var seasonality = InvestmentReportCalculator.seasonality(txs);
        eq(total.net().toPlainString(), seasonality.months().stream().map(m -> m.totalNet()).reduce(BigDecimal.ZERO, BigDecimal::add));
        var cmp = InvestmentReportCalculator.comparison(txs, List.of(), from, to);
        eq(total.net().toPlainString(), cmp.current().net());
    }

    @Test
    void lotsRepayOldestDepositFirstAndAgeWhatIsLeft() {
        var asOf = java.time.LocalDate.of(2026, 4, 30);
        var r = InvestmentReportCalculator.lots(List.of(
            acc(1, Kind.DEPOSIT, "100", "2026-01-01T10:00:00+07:00"), acc(1, Kind.DEPOSIT, "200", "2026-02-01T10:00:00+07:00"),
            acc(1, Kind.WITHDRAWAL, "150", "2026-02-10T10:00:00+07:00"), // lot1 100 done, lot2 50 recovered
            acc(1, Kind.BONUS, "999", "2026-02-11T10:00:00+07:00"),     // bonus never repays capital
            acc(1, Kind.WITHDRAWAL, "400", "2026-03-01T10:00:00+07:00"), // lot2 150 done, 250 is profit
            acc(2, Kind.DEPOSIT, "50", "2026-04-20T10:00:00+07:00")), asOf);
        assertEquals(3, r.lotCount());
        assertEquals(2, r.recoveredLots());
        eq("350", r.totalDeposited());
        eq("300", r.totalRecovered());
        eq("50", r.outstanding());
        var byDate = r.lots();
        assertEquals(java.time.LocalDate.of(2026, 4, 20), byDate.get(0).depositDate()); // newest first
        assertNull(byDate.get(0).recoveredDate());
        assertEquals(10L, byDate.get(0).ageDays());
        var lot1 = byDate.get(2);
        assertEquals(java.time.LocalDate.of(2026, 2, 10), lot1.recoveredDate());
        assertEquals(40L, lot1.daysToRecover());
        var lot2 = byDate.get(1);
        assertEquals(java.time.LocalDate.of(2026, 3, 1), lot2.recoveredDate());
        eq("200", lot2.recovered());
        eq("34.00", r.averageDaysToRecover()); // (40 + 28) / 2
        assertEquals(1, r.aging().get(0).lots());
        eq("50", r.aging().get(0).outstanding());
        assertEquals(0, r.aging().get(2).lots());
        assertNull(InvestmentReportCalculator.lots(List.of(), asOf).averageDaysToRecover());
        var many = new java.util.ArrayList<Tx>();
        for (int i = 0; i < InvestmentReportCalculator.LOT_LIMIT + 3; i++) many.add(acc(1, Kind.DEPOSIT, "1", "2026-01-01T10:00:00+07:00"));
        var capped = InvestmentReportCalculator.lots(many, asOf);
        assertTrue(capped.truncated());
        assertEquals(InvestmentReportCalculator.LOT_LIMIT, capped.lots().size());
        assertEquals(InvestmentReportCalculator.LOT_LIMIT + 3, capped.lotCount());
    }

    @Test
    void allocationSharesAndConcentrationBands() {
        var r = InvestmentReportCalculator.allocation(List.of(
            acc(1, Kind.DEPOSIT, "800", "2026-01-01T10:00:00+07:00"), acc(1, Kind.WITHDRAWAL, "200", "2026-01-05T10:00:00+07:00"), // open 600
            acc(2, Kind.DEPOSIT, "400", "2026-01-02T10:00:00+07:00"),                                                          // open 400
            acc(3, Kind.DEPOSIT, "100", "2026-01-03T10:00:00+07:00"), acc(3, Kind.WITHDRAWAL, "900", "2026-01-04T10:00:00+07:00"))); // open 0 (profit)
        eq("1300", r.totalDeposits());
        eq("1000", r.totalOutstanding());
        assertEquals(1L, r.rows().get(0).accountId());
        eq("60.00", r.rows().get(0).outstandingSharePct());
        eq("40.00", r.rows().get(1).outstandingSharePct());
        eq("0.00", r.rows().get(2).outstandingSharePct());
        eq("61.54", r.rows().get(0).depositSharePct());
        eq("5200", r.hhi()); // 60^2 + 40^2
        assertEquals("CONCENTRATED", r.concentration());
        eq("60.00", r.topSharePct());
        var even = new java.util.ArrayList<Tx>();
        for (int i = 1; i <= 10; i++) even.add(acc(i, Kind.DEPOSIT, "100", "2026-01-01T10:00:00+07:00"));
        var diversified = InvestmentReportCalculator.allocation(even);
        eq("1000", diversified.hhi());
        assertEquals("DIVERSIFIED", diversified.concentration());
        var none = InvestmentReportCalculator.allocation(List.of(acc(1, Kind.WITHDRAWAL, "5", "2026-01-01T10:00:00+07:00")));
        assertNull(none.hhi());
        assertEquals("NONE", none.concentration());
        assertNull(none.topSharePct());
    }
}
