package com.kira.bank.investment.application;

import com.kira.bank.investment.application.InvestmentReportDtos.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.time.temporal.IsoFields;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

/** Pure report maths over completed investment transactions; one currency per call. */
final class InvestmentReportCalculator {
    private InvestmentReportCalculator() {
    }

    enum Kind { DEPOSIT, WITHDRAWAL, BONUS }

    record Tx(Long accountId, String accountName, String currency, Kind kind, BigDecimal amount, ZonedDateTime at) {
        LocalDate date() { return at.toLocalDate(); }
    }

    static Totals totals(Collection<Tx> txs) {
        BigDecimal d = BigDecimal.ZERO, w = BigDecimal.ZERO, b = BigDecimal.ZERO;
        for (Tx t : txs) {
            switch (t.kind()) {
                case DEPOSIT -> d = d.add(t.amount());
                case WITHDRAWAL -> w = w.add(t.amount());
                case BONUS -> b = b.add(t.amount());
            }
        }
        return new Totals(txs.size(), d, w, b, w.subtract(d), w.add(b).subtract(d));
    }

    /** One row per calendar bucket between from and to (empty buckets included) so change % and averages compare adjacent periods. */
    static PeriodicReport periodic(List<Tx> txs, String granularity, LocalDate from, LocalDate to) {
        Map<LocalDate, List<Tx>> buckets = new TreeMap<>();
        for (LocalDate b = bucketStart(from, granularity); !b.isAfter(to); b = nextBucket(b, granularity)) buckets.put(b, new ArrayList<>());
        for (Tx t : txs) buckets.computeIfAbsent(bucketStart(t.date(), granularity), k -> new ArrayList<>()).add(t);
        List<PeriodRow> rows = new ArrayList<>();
        BigDecimal cumulative = BigDecimal.ZERO, previous = null;
        for (Map.Entry<LocalDate, List<Tx>> e : buckets.entrySet()) {
            Totals totals = totals(e.getValue());
            cumulative = cumulative.add(totals.net());
            BigDecimal change = previous == null ? null : totals.net().subtract(previous);
            rows.add(new PeriodRow(label(e.getKey(), granularity), e.getKey(), totals, cumulative, change,
                pct(change, previous)));
            previous = totals.net();
        }
        PeriodRow best = rows.stream().filter(r -> r.totals().count() > 0).max(Comparator.comparing(r -> r.totals().net())).orElse(null);
        PeriodRow worst = rows.stream().filter(r -> r.totals().count() > 0).min(Comparator.comparing(r -> r.totals().net())).orElse(null);
        long wins = rows.stream().filter(r -> r.totals().net().signum() > 0).count();
        long losses = rows.stream().filter(r -> r.totals().net().signum() < 0).count();
        Totals all = totals(txs);
        BigDecimal avg = rows.isEmpty() ? BigDecimal.ZERO
            : all.net().divide(BigDecimal.valueOf(rows.size()), 4, RoundingMode.HALF_UP);
        return new PeriodicReport(granularity, all, avg, best, worst, wins, losses, rows);
    }

    private static LocalDate nextBucket(LocalDate start, String granularity) {
        return switch (granularity) {
            case "DAY" -> start.plusDays(1);
            case "WEEK" -> start.plusWeeks(1);
            case "QUARTER" -> start.plusMonths(3);
            case "YEAR" -> start.plusYears(1);
            default -> start.plusMonths(1);
        };
    }

    static LocalDate bucketStart(LocalDate d, String granularity) {
        return switch (granularity) {
            case "DAY" -> d;
            case "WEEK" -> d.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            case "QUARTER" -> LocalDate.of(d.getYear(), (d.get(IsoFields.QUARTER_OF_YEAR) - 1) * 3 + 1, 1);
            case "YEAR" -> d.withDayOfYear(1);
            default -> d.withDayOfMonth(1);
        };
    }

    private static String label(LocalDate start, String granularity) {
        return switch (granularity) {
            case "DAY", "WEEK" -> start.toString();
            case "QUARTER" -> start.getYear() + "-Q" + start.get(IsoFields.QUARTER_OF_YEAR);
            case "YEAR" -> String.valueOf(start.getYear());
            default -> start.toString().substring(0, 7);
        };
    }

    /** Percent change relative to |previous|; null when there is no usable baseline. */
    static BigDecimal pct(BigDecimal change, BigDecimal previous) {
        if (change == null || previous == null || previous.signum() == 0) return null;
        return change.multiply(BigDecimal.valueOf(100)).divide(previous.abs(), 2, RoundingMode.HALF_UP);
    }

    static AccountsReport accounts(List<Tx> txs, LocalDate asOf) {
        Map<Long, List<Tx>> byAccount = new LinkedHashMap<>();
        txs.forEach(t -> byAccount.computeIfAbsent(t.accountId(), k -> new ArrayList<>()).add(t));
        Totals all = totals(txs);
        List<AccountRow> rows = new ArrayList<>();
        byAccount.forEach((id, list) -> {
            Totals tot = totals(list);
            LocalDate first = list.stream().map(Tx::date).min(Comparator.naturalOrder()).orElse(asOf);
            LocalDate last = list.stream().map(Tx::date).max(Comparator.naturalOrder()).orElse(asOf);
            rows.add(new AccountRow(id, list.get(0).accountName(), tot, pct(tot.net(), tot.deposits()),
                average(list, Kind.DEPOSIT), average(list, Kind.WITHDRAWAL), first, last,
                java.time.temporal.ChronoUnit.DAYS.between(last, asOf), pct(tot.net(), all.net())));
        });
        rows.sort(Comparator.comparing((AccountRow r) -> r.totals().net()).reversed());
        return new AccountsReport(all, rows);
    }

    static EquityReport equity(List<Tx> txs, LocalDate from, LocalDate to) {
        Map<LocalDate, BigDecimal> daily = dailyNet(txs);
        List<EquityPoint> points = new ArrayList<>();
        BigDecimal cumulative = BigDecimal.ZERO, peak = BigDecimal.ZERO, maxDd = BigDecimal.ZERO;
        LocalDate maxDdDate = null;
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            BigDecimal net = daily.getOrDefault(d, BigDecimal.ZERO);
            cumulative = cumulative.add(net);
            peak = peak.max(cumulative);
            BigDecimal dd = peak.subtract(cumulative);
            if (dd.compareTo(maxDd) > 0) { maxDd = dd; maxDdDate = d; }
            points.add(new EquityPoint(d, net, cumulative, peak, dd));
        }
        DayNet best = null, worst = null;
        long wins = 0, losses = 0, longestWin = 0, longestLoss = 0, streak = 0;
        for (Map.Entry<LocalDate, BigDecimal> e : daily.entrySet()) {
            int sign = e.getValue().signum();
            if (best == null || e.getValue().compareTo(best.net()) > 0) best = new DayNet(e.getKey(), e.getValue());
            if (worst == null || e.getValue().compareTo(worst.net()) < 0) worst = new DayNet(e.getKey(), e.getValue());
            if (sign > 0) { wins++; streak = streak > 0 ? streak + 1 : 1; longestWin = Math.max(longestWin, streak); }
            else if (sign < 0) { losses++; streak = streak < 0 ? streak - 1 : -1; longestLoss = Math.max(longestLoss, -streak); }
            else streak = 0;
        }
        BigDecimal last = points.isEmpty() ? BigDecimal.ZERO : points.get(points.size() - 1).drawdown();
        return new EquityReport(points, cumulative, peak, maxDd, maxDdDate, last, best, worst, daily.size(), wins,
            losses, longestWin, longestLoss, streak);
    }

    static ActivityReport activity(List<Tx> txs) {
        int[][] matrix = new int[7][24];
        List<List<Tx>> weekdays = slots(7), hours = slots(24), days = slots(31);
        for (Tx t : txs) {
            int wd = t.at().getDayOfWeek().getValue(), h = t.at().getHour(), dom = t.at().getDayOfMonth();
            matrix[wd - 1][h]++;
            weekdays.get(wd - 1).add(t);
            hours.get(h).add(t);
            days.get(dom - 1).add(t);
        }
        return new ActivityReport(toSlots(weekdays, 1), toSlots(hours, 0), toSlots(days, 1), matrix,
            busiest(weekdays) + 1, busiest(hours), busiest(days) + 1);
    }

    private static List<List<Tx>> slots(int n) {
        List<List<Tx>> list = new ArrayList<>(n);
        for (int i = 0; i < n; i++) list.add(new ArrayList<>());
        return list;
    }

    private static List<Slot> toSlots(List<List<Tx>> groups, int firstKey) {
        List<Slot> out = new ArrayList<>(groups.size());
        for (int i = 0; i < groups.size(); i++) out.add(new Slot(i + firstKey, totals(groups.get(i))));
        return out;
    }

    /** Index of the group with the most transactions (the first one on ties). */
    private static int busiest(List<List<Tx>> groups) {
        int best = 0;
        for (int i = 1; i < groups.size(); i++) if (groups.get(i).size() > groups.get(best).size()) best = i;
        return best;
    }

    static DistributionReport distribution(List<Tx> txs) {
        List<TypeStats> stats = new ArrayList<>();
        for (Kind k : Kind.values()) {
            List<BigDecimal> v = txs.stream().filter(t -> t.kind() == k).map(Tx::amount).sorted().toList();
            if (v.isEmpty()) continue;
            BigDecimal sum = v.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
            stats.add(new TypeStats(k.name(), v.size(), sum, v.get(0), v.get(v.size() - 1),
                sum.divide(BigDecimal.valueOf(v.size()), 4, RoundingMode.HALF_UP), median(v), percentile(v, 90)));
        }
        List<SizeBucket> buckets = new ArrayList<>();
        if (!txs.isEmpty()) {
            BigDecimal min = txs.stream().map(Tx::amount).min(Comparator.naturalOrder()).get();
            BigDecimal max = txs.stream().map(Tx::amount).max(Comparator.naturalOrder()).get();
            int n = max.compareTo(min) == 0 ? 1 : 8;
            BigDecimal width = n == 1 ? BigDecimal.ONE : max.subtract(min).divide(BigDecimal.valueOf(n), 4, RoundingMode.CEILING);
            long[][] counts = new long[n][3];
            for (Tx t : txs) {
                int i = n == 1 ? 0 : Math.min(n - 1, t.amount().subtract(min).divide(width, 0, RoundingMode.DOWN).intValue());
                counts[i][t.kind().ordinal()]++;
            }
            for (int i = 0; i < n; i++) {
                BigDecimal lo = min.add(width.multiply(BigDecimal.valueOf(i)));
                buckets.add(new SizeBucket(lo, n == 1 ? min : lo.add(width), counts[i][0], counts[i][1], counts[i][2]));
            }
        }
        List<TopTransaction> largest = txs.stream().sorted(Comparator.comparing(Tx::amount).reversed()).limit(10)
            .map(t -> new TopTransaction(t.accountName(), t.kind().name(), t.amount(), t.at().toOffsetDateTime())).toList();
        return new DistributionReport(stats, buckets, largest);
    }

    static ComparisonReport comparison(List<Tx> current, List<Tx> previous, LocalDate prevFrom, LocalDate prevTo) {
        Totals c = totals(current), p = totals(previous);
        List<MetricDelta> deltas = List.of(
            delta("COUNT", BigDecimal.valueOf(c.count()), BigDecimal.valueOf(p.count())),
            delta("DEPOSITS", c.deposits(), p.deposits()), delta("WITHDRAWALS", c.withdrawals(), p.withdrawals()),
            delta("BONUSES", c.bonuses(), p.bonuses()), delta("NET", c.net(), p.net()),
            delta("NET_WITH_BONUS", c.netWithBonus(), p.netWithBonus()));
        return new ComparisonReport(prevFrom, prevTo, c, p, deltas);
    }

    private static MetricDelta delta(String metric, BigDecimal current, BigDecimal previous) {
        BigDecimal change = current.subtract(previous);
        return new MetricDelta(metric, current, previous, change, pct(change, previous));
    }

    private static BigDecimal average(List<Tx> txs, Kind kind) {
        List<Tx> list = txs.stream().filter(t -> t.kind() == kind).toList();
        if (list.isEmpty()) return BigDecimal.ZERO;
        return list.stream().map(Tx::amount).reduce(BigDecimal.ZERO, BigDecimal::add)
            .divide(BigDecimal.valueOf(list.size()), 4, RoundingMode.HALF_UP);
    }

    private static BigDecimal median(List<BigDecimal> sorted) {
        int n = sorted.size();
        return n % 2 == 1 ? sorted.get(n / 2)
            : sorted.get(n / 2 - 1).add(sorted.get(n / 2)).divide(BigDecimal.valueOf(2), 4, RoundingMode.HALF_UP);
    }

    /** Nearest-rank percentile on an ascending list. */
    private static BigDecimal percentile(List<BigDecimal> sorted, int p) {
        int rank = (int) Math.ceil(p / 100.0 * sorted.size());
        return sorted.get(Math.max(0, rank - 1));
    }

    static DailyReport daily(List<Tx> txs) {
        Map<LocalDate, List<Tx>> byDay = new TreeMap<>();
        txs.forEach(t -> byDay.computeIfAbsent(t.date(), k -> new ArrayList<>()).add(t));
        List<DayRow> days = byDay.entrySet().stream().map(e -> new DayRow(e.getKey(), totals(e.getValue()))).toList();
        DayRow best = days.stream().max(Comparator.comparing(d -> d.totals().net())).orElse(null);
        DayRow worst = days.stream().min(Comparator.comparing(d -> d.totals().net())).orElse(null);
        Totals all = totals(txs);
        BigDecimal n = BigDecimal.valueOf(Math.max(1, days.size()));
        return new DailyReport(all, days, best, worst, all.net().divide(n, 4, RoundingMode.HALF_UP),
            BigDecimal.valueOf(all.count()).divide(n, 2, RoundingMode.HALF_UP));
    }

    static RollingReport rolling(List<Tx> txs, LocalDate from, LocalDate to) {
        Map<LocalDate, BigDecimal> net = dailyNet(txs);
        List<RollingPoint> points = new ArrayList<>();
        BigDecimal r7 = BigDecimal.ZERO, r30 = BigDecimal.ZERO, sum = BigDecimal.ZERO;
        BigDecimal best7 = null, worst7 = null;
        List<BigDecimal> series = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            BigDecimal v = net.getOrDefault(d, BigDecimal.ZERO);
            series.add(v);
            int i = series.size() - 1;
            r7 = r7.add(v);
            r30 = r30.add(v);
            if (i >= 7) r7 = r7.subtract(series.get(i - 7));
            if (i >= 30) r30 = r30.subtract(series.get(i - 30));
            sum = sum.add(v);
            points.add(new RollingPoint(d, v, r7, r30));
            if (i >= 6) {
                best7 = best7 == null ? r7 : best7.max(r7);
                worst7 = worst7 == null ? r7 : worst7.min(r7);
            }
        }
        int n = series.size();
        BigDecimal mean = n == 0 ? BigDecimal.ZERO : sum.divide(BigDecimal.valueOf(n), 8, RoundingMode.HALF_UP);
        BigDecimal variance = BigDecimal.ZERO;
        for (BigDecimal v : series) variance = variance.add(v.subtract(mean).pow(2));
        BigDecimal vol = n < 2 ? BigDecimal.ZERO
            : variance.divide(BigDecimal.valueOf(n - 1L), 8, RoundingMode.HALF_UP).sqrt(new java.math.MathContext(12)).setScale(4, RoundingMode.HALF_UP);
        RollingPoint last = points.isEmpty() ? null : points.get(points.size() - 1);
        return new RollingReport(points, last == null ? BigDecimal.ZERO : last.rolling7(), last == null ? BigDecimal.ZERO : last.rolling30(),
            best7, worst7, mean.setScale(4, RoundingMode.HALF_UP), vol);
    }

    static BonusReport bonus(List<Tx> txs) {
        BigDecimal bonuses = BigDecimal.ZERO, deposits = BigDecimal.ZERO, largest = BigDecimal.ZERO;
        long bonusCount = 0;
        Map<String, BonusAcc> months = new TreeMap<>(), accounts = new LinkedHashMap<>();
        for (Tx t : txs) {
            BonusAcc m = months.computeIfAbsent(t.date().toString().substring(0, 7), BonusAcc::new);
            BonusAcc a = accounts.computeIfAbsent(String.valueOf(t.accountId()), k -> new BonusAcc(t.accountName()));
            if (t.kind() == Kind.DEPOSIT) { deposits = deposits.add(t.amount()); m.deposits = m.deposits.add(t.amount()); a.deposits = a.deposits.add(t.amount()); }
            if (t.kind() == Kind.BONUS) {
                bonuses = bonuses.add(t.amount()); bonusCount++; largest = largest.max(t.amount());
                m.bonuses = m.bonuses.add(t.amount()); a.bonuses = a.bonuses.add(t.amount()); m.count++; a.count++;
            }
        }
        Totals all = totals(txs);
        BigDecimal avg = bonusCount == 0 ? BigDecimal.ZERO : bonuses.divide(BigDecimal.valueOf(bonusCount), 4, RoundingMode.HALF_UP);
        BigDecimal positive = all.netWithBonus().signum() > 0 ? all.netWithBonus() : null;
        List<BonusRow> byAccount = new ArrayList<>(accounts.entrySet().stream().map(e -> e.getValue().row(e.getKey(), e.getValue().label)).toList());
        byAccount.sort(Comparator.comparing(BonusRow::bonuses).reversed());
        return new BonusReport(bonuses, deposits, pct(bonuses, deposits), pct(bonuses, positive), avg, largest,
            months.entrySet().stream().map(e -> e.getValue().row(e.getKey(), e.getKey())).toList(), byAccount);
    }

    private static final class BonusAcc {
        final String label;
        BigDecimal bonuses = BigDecimal.ZERO, deposits = BigDecimal.ZERO;
        long count;
        BonusAcc(String label) { this.label = label; }
        BonusRow row(String key, String label) { return new BonusRow(key, label, bonuses, deposits, pct(bonuses, deposits), count); }
    }

    static PaybackReport payback(List<Tx> txs) {
        Map<Long, List<Tx>> byAccount = new LinkedHashMap<>();
        txs.forEach(t -> byAccount.computeIfAbsent(t.accountId(), k -> new ArrayList<>()).add(t));
        List<PaybackRow> rows = new ArrayList<>();
        byAccount.forEach((id, list) -> {
            BigDecimal d = BigDecimal.ZERO, w = BigDecimal.ZERO;
            LocalDate first = list.get(0).date(), breakEven = null;
            for (Tx t : list) {
                if (t.kind() == Kind.BONUS) continue; // bonuses are not recovered cash
                if (t.kind() == Kind.DEPOSIT) d = d.add(t.amount()); else w = w.add(t.amount());
                // Break-even is a current state: set when recovered cash covers the deposits, cleared when new deposits break it again.
                boolean covered = d.signum() > 0 && w.compareTo(d) >= 0;
                if (covered && breakEven == null) breakEven = t.date();
                else if (!covered) breakEven = null;
            }
            rows.add(new PaybackRow(id, list.get(0).accountName(), d, w, ratio(w, d), d.subtract(w), breakEven != null,
                first, breakEven, breakEven == null ? null : java.time.temporal.ChronoUnit.DAYS.between(first, breakEven)));
        });
        rows.sort(Comparator.comparing(PaybackRow::outstanding).reversed());
        Totals all = totals(txs);
        return new PaybackReport(all.deposits(), all.withdrawals(), ratio(all.withdrawals(), all.deposits()),
            all.deposits().subtract(all.withdrawals()), rows.stream().filter(PaybackRow::brokeEven).count(),
            rows.stream().filter(r -> r.outstanding().signum() > 0).count(), rows);
    }

    static SeasonalityReport seasonality(List<Tx> txs) {
        Map<String, BigDecimal> byYearMonth = new TreeMap<>();
        long[] counts = new long[13];
        for (Tx t : txs) {
            byYearMonth.merge(t.date().getYear() + "-" + t.date().getMonthValue(), signedNet(t), BigDecimal::add);
            counts[t.date().getMonthValue()]++;
        }
        BigDecimal[] sums = new BigDecimal[13];
        long[] occurrences = new long[13], wins = new long[13];
        Arrays.fill(sums, BigDecimal.ZERO);
        byYearMonth.forEach((key, net) -> {
            int m = Integer.parseInt(key.substring(key.indexOf('-') + 1));
            sums[m] = sums[m].add(net);
            occurrences[m]++;
            if (net.signum() > 0) wins[m]++;
        });
        List<SeasonalMonth> months = new ArrayList<>();
        for (int m = 1; m <= 12; m++) {
            BigDecimal avg = occurrences[m] == 0 ? BigDecimal.ZERO
                : sums[m].divide(BigDecimal.valueOf(occurrences[m]), 4, RoundingMode.HALF_UP);
            months.add(new SeasonalMonth(m, occurrences[m], wins[m], counts[m], sums[m], avg));
        }
        List<SeasonalMonth> active = months.stream().filter(x -> x.occurrences() > 0).toList();
        return new SeasonalityReport(months, active.stream().max(Comparator.comparing(SeasonalMonth::averageNet)).orElse(null),
            active.stream().min(Comparator.comparing(SeasonalMonth::averageNet)).orElse(null));
    }

    /**
     * Run-rate estimate, not a forecast: trailing 30-calendar-day net per day extended over the remaining days.
     * txs must cover at least the first of asOf's month and the 90 days before asOf; firstEver is the user's earliest
     * transaction date (null if none) so a young history is not diluted by days before it existed.
     */
    static ProjectionReport projection(List<Tx> txs, LocalDate asOf, LocalDate firstEver) {
        LocalDate monthStart = asOf.withDayOfMonth(1);
        BigDecimal mtd = BigDecimal.ZERO, t30 = BigDecimal.ZERO, t90 = BigDecimal.ZERO;
        for (Tx t : txs) {
            LocalDate d = t.date();
            if (d.isAfter(asOf)) continue;
            BigDecimal n = signedNet(t);
            if (!d.isBefore(monthStart)) mtd = mtd.add(n);
            if (d.isAfter(asOf.minusDays(30))) t30 = t30.add(n);
            if (d.isAfter(asOf.minusDays(90))) t90 = t90.add(n);
        }
        long observed = firstEver == null ? 1 : Math.max(1, Math.min(30, java.time.temporal.ChronoUnit.DAYS.between(firstEver, asOf) + 1));
        BigDecimal rate = t30.divide(BigDecimal.valueOf(observed), 4, RoundingMode.HALF_UP);
        int remaining = asOf.lengthOfMonth() - asOf.getDayOfMonth();
        return new ProjectionReport(asOf, mtd, asOf.getDayOfMonth(), remaining, rate,
            mtd.add(rate.multiply(BigDecimal.valueOf(remaining))), rate.multiply(BigDecimal.valueOf(30)),
            rate.multiply(BigDecimal.valueOf(365)), t30, t90, observed);
    }

    /** Net per calendar day (withdrawals - deposits; bonuses count as a flat active day), ascending. */
    private static TreeMap<LocalDate, BigDecimal> dailyNet(List<Tx> txs) {
        TreeMap<LocalDate, BigDecimal> daily = new TreeMap<>();
        txs.forEach(t -> daily.merge(t.date(), signedNet(t), BigDecimal::add));
        return daily;
    }

    private static BigDecimal signedNet(Tx t) {
        return t.kind() == Kind.DEPOSIT ? t.amount().negate() : t.kind() == Kind.WITHDRAWAL ? t.amount() : BigDecimal.ZERO;
    }

    private static BigDecimal ratio(BigDecimal part, BigDecimal whole) {
        return whole.signum() == 0 ? null : part.multiply(BigDecimal.valueOf(100)).divide(whole, 2, RoundingMode.HALF_UP);
    }

    static final int LEDGER_LIMIT = 1000;

    static LedgerReport ledger(List<Tx> txs) {
        List<LedgerRow> rows = new ArrayList<>(txs.size());
        BigDecimal running = BigDecimal.ZERO;
        for (Tx t : txs) {
            BigDecimal signed = signedNet(t);
            running = running.add(signed);
            rows.add(new LedgerRow(t.at().toOffsetDateTime(), t.accountId(), t.accountName(), t.kind().name(), t.amount(), signed, running));
        }
        Collections.reverse(rows);
        boolean truncated = rows.size() > LEDGER_LIMIT;
        return new LedgerReport(totals(txs), truncated, LEDGER_LIMIT, truncated ? new ArrayList<>(rows.subList(0, LEDGER_LIMIT)) : rows);
    }

    static OverviewReport overview(List<Tx> txs, LocalDate asOf) {
        Totals all = totals(txs);
        Map<Long, BigDecimal> net = new LinkedHashMap<>();
        Map<Long, String> names = new HashMap<>();
        Set<LocalDate> days = new HashSet<>();
        BigDecimal currentMonth = BigDecimal.ZERO, previousMonth = BigDecimal.ZERO;
        java.time.YearMonth cur = java.time.YearMonth.from(asOf), prev = cur.minusMonths(1);
        for (Tx t : txs) {
            net.merge(t.accountId(), signedNet(t), BigDecimal::add);
            names.put(t.accountId(), t.accountName());
            days.add(t.date());
            java.time.YearMonth ym = java.time.YearMonth.from(t.date());
            if (ym.equals(cur)) currentMonth = currentMonth.add(signedNet(t));
            else if (ym.equals(prev)) previousMonth = previousMonth.add(signedNet(t));
        }
        AccountBrief best = null, worst = null;
        for (Map.Entry<Long, BigDecimal> e : net.entrySet()) {
            AccountBrief b = new AccountBrief(e.getKey(), names.get(e.getKey()), e.getValue());
            if (best == null || b.net().compareTo(best.net()) > 0) best = b;
            if (worst == null || b.net().compareTo(worst.net()) < 0) worst = b;
        }
        Tx first = txs.isEmpty() ? null : txs.get(0), last = txs.isEmpty() ? null : txs.get(txs.size() - 1);
        BigDecimal avg = txs.isEmpty() ? BigDecimal.ZERO
            : txs.stream().map(Tx::amount).reduce(BigDecimal.ZERO, BigDecimal::add).divide(BigDecimal.valueOf(txs.size()), 4, RoundingMode.HALF_UP);
        return new OverviewReport(all, net.size(), days.size(), first == null ? null : first.date(), last == null ? null : last.date(),
            last == null ? null : last.at().toOffsetDateTime(), avg, ratio(all.withdrawals(), all.deposits()), best, worst,
            cur.toString(), currentMonth, previousMonth, currentMonth.subtract(previousMonth));
    }

    static MatrixReport matrix(List<Tx> txs, LocalDate from, LocalDate to) {
        List<String> months = new ArrayList<>();
        for (java.time.YearMonth m = java.time.YearMonth.from(from); !m.isAfter(java.time.YearMonth.from(to)); m = m.plusMonths(1))
            months.add(m.toString());
        Map<Long, BigDecimal[]> byAccount = new LinkedHashMap<>();
        Map<Long, String> names = new HashMap<>();
        BigDecimal[] totalsByMonth = new BigDecimal[months.size()];
        Arrays.fill(totalsByMonth, BigDecimal.ZERO);
        for (Tx t : txs) {
            int i = months.indexOf(java.time.YearMonth.from(t.date()).toString());
            if (i < 0) continue;
            BigDecimal[] cells = byAccount.computeIfAbsent(t.accountId(), k -> { BigDecimal[] a = new BigDecimal[months.size()]; Arrays.fill(a, BigDecimal.ZERO); return a; });
            names.put(t.accountId(), t.accountName());
            cells[i] = cells[i].add(signedNet(t));
            totalsByMonth[i] = totalsByMonth[i].add(signedNet(t));
        }
        List<MatrixRow> rows = new ArrayList<>();
        byAccount.forEach((id, cells) -> {
            List<BigDecimal> running = new ArrayList<>(cells.length);
            BigDecimal sum = BigDecimal.ZERO;
            for (BigDecimal cell : cells) { sum = sum.add(cell); running.add(sum); }
            rows.add(new MatrixRow(id, names.get(id), List.of(cells), running, sum));
        });
        rows.sort(Comparator.comparing(MatrixRow::total).reversed());
        List<BigDecimal> cumulativeTotals = new ArrayList<>(totalsByMonth.length);
        BigDecimal running = BigDecimal.ZERO;
        for (BigDecimal monthTotal : totalsByMonth) { running = running.add(monthTotal); cumulativeTotals.add(running); }
        return new MatrixReport(months, rows, List.of(totalsByMonth), cumulativeTotals);
    }

    static DrawdownReport drawdowns(List<Tx> txs, LocalDate from, LocalDate to) {
        Map<LocalDate, BigDecimal> daily = dailyNet(txs);
        List<DrawdownEpisode> episodes = new ArrayList<>();
        BigDecimal cumulative = BigDecimal.ZERO, peak = BigDecimal.ZERO, trough = null;
        LocalDate peakDate = from.minusDays(1), start = null, troughDate = null;
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            cumulative = cumulative.add(daily.getOrDefault(d, BigDecimal.ZERO));
            if (cumulative.compareTo(peak) >= 0) {
                if (start != null) {
                    episodes.add(episode(peakDate, start, troughDate, d, peak.subtract(trough), d));
                    start = null;
                }
                peak = cumulative;
                peakDate = d;
            } else {
                if (start == null) { start = d; trough = cumulative; troughDate = d; }
                else if (cumulative.compareTo(trough) < 0) { trough = cumulative; troughDate = d; }
            }
        }
        boolean ongoing = start != null;
        if (ongoing) episodes.add(episode(peakDate, start, troughDate, null, peak.subtract(trough), to));
        long longest = episodes.stream().mapToLong(DrawdownEpisode::durationDays).max().orElse(0);
        BigDecimal deepest = episodes.stream().map(DrawdownEpisode::depth).max(Comparator.naturalOrder()).orElse(BigDecimal.ZERO);
        List<DrawdownEpisode> top = episodes.stream().sorted(Comparator.comparing(DrawdownEpisode::depth).reversed()).limit(20).toList();
        return new DrawdownReport(top, episodes.size(), ongoing, longest, deepest);
    }

    private static DrawdownEpisode episode(LocalDate peakDate, LocalDate start, LocalDate troughDate, LocalDate recovery,
                                           BigDecimal depth, LocalDate end) {
        return new DrawdownEpisode(peakDate, start, troughDate, recovery, depth,
            java.time.temporal.ChronoUnit.DAYS.between(start, troughDate),
            recovery == null ? null : java.time.temporal.ChronoUnit.DAYS.between(troughDate, recovery),
            java.time.temporal.ChronoUnit.DAYS.between(start, end) + (recovery == null ? 1 : 0));
    }

    static CadenceReport cadence(List<Tx> txs) {
        Map<Long, List<Tx>> byAccount = new LinkedHashMap<>();
        txs.forEach(t -> byAccount.computeIfAbsent(t.accountId(), k -> new ArrayList<>()).add(t));
        List<CadenceRow> rows = new ArrayList<>();
        long gapSum = 0, gapCount = 0, turnSum = 0, turnCount = 0;
        for (Map.Entry<Long, List<Tx>> e : byAccount.entrySet()) {
            List<Tx> list = e.getValue();
            long sum = 0, longest = 0, tSum = 0, tCount = 0;
            LocalDate gapFrom = null, gapTo = null, lastDeposit = null;
            for (int i = 0; i < list.size(); i++) {
                Tx t = list.get(i);
                if (i > 0) {
                    long gap = java.time.temporal.ChronoUnit.DAYS.between(list.get(i - 1).date(), t.date());
                    sum += gap;
                    if (gap > longest) { longest = gap; gapFrom = list.get(i - 1).date(); gapTo = t.date(); }
                }
                if (t.kind() == Kind.DEPOSIT) lastDeposit = t.date();
                else if (t.kind() == Kind.WITHDRAWAL && lastDeposit != null) { tSum += java.time.temporal.ChronoUnit.DAYS.between(lastDeposit, t.date()); tCount++; }
            }
            long gaps = list.size() - 1L;
            gapSum += sum; gapCount += gaps; turnSum += tSum; turnCount += tCount;
            rows.add(new CadenceRow(e.getKey(), list.get(0).accountName(), list.size(), avg(sum, gaps), longest, gapFrom, gapTo, avg(tSum, tCount)));
        }
        rows.sort(Comparator.comparing(CadenceRow::transactions).reversed());
        return new CadenceReport(avg(gapSum, gapCount), avg(turnSum, turnCount), rows);
    }

    private static BigDecimal avg(long sum, long count) {
        return count == 0 ? null : BigDecimal.valueOf(sum).divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP);
    }

    /** Progress of net (withdrawals - deposits) toward each goal, measured over the calendar month/year containing asOf. */
    static GoalsReport goals(List<Tx> txs, List<Goal> goals, LocalDate asOf) {
        List<GoalProgress> out = new ArrayList<>();
        for (Goal g : goals) {
            boolean year = g.period().equals("YEAR");
            LocalDate start = year ? asOf.withDayOfYear(1) : asOf.withDayOfMonth(1);
            int length = year ? asOf.lengthOfYear() : asOf.lengthOfMonth();
            int elapsed = year ? asOf.getDayOfYear() : asOf.getDayOfMonth();
            BigDecimal achieved = BigDecimal.ZERO;
            for (Tx t : txs) if (!t.date().isBefore(start) && !t.date().isAfter(asOf)) achieved = achieved.add(signedNet(t));
            BigDecimal remaining = g.targetAmount().subtract(achieved).max(BigDecimal.ZERO);
            BigDecimal elapsedPct = BigDecimal.valueOf(elapsed * 100L).divide(BigDecimal.valueOf(length), 2, RoundingMode.HALF_UP);
            BigDecimal pct = achieved.multiply(BigDecimal.valueOf(100)).divide(g.targetAmount(), 2, RoundingMode.HALF_UP);
            int daysRemaining = length - elapsed;
            BigDecimal requiredDaily = daysRemaining == 0 ? remaining : remaining.divide(BigDecimal.valueOf(daysRemaining), 4, RoundingMode.HALF_UP);
            out.add(new GoalProgress(g.id(), g.period(), g.targetAmount(), achieved, remaining, pct, elapsedPct,
                pct.compareTo(elapsedPct) >= 0, achieved.compareTo(g.targetAmount()) >= 0, requiredDaily, daysRemaining));
        }
        return new GoalsReport(asOf, out);
    }

    static final int DORMANT_DAYS = 30, IDLE_DAYS = 14, STREAK_DAYS = 3, STREAK_FRESH_DAYS = 7;

    /**
     * Rule-based observations; codes are translated by the clients. WARN sorts before INFO before GOOD.
     * txs should reach back at least {@code DORMANT_DAYS} before asOf (dormancy needs history outside the window);
     * streak, drawdown, month and anomaly rules only use transactions on or after {@code from}.
     */
    static InsightsReport insights(List<Tx> txs, LocalDate from, LocalDate asOf) {
        List<Insight> out = new ArrayList<>();
        for (AccountRow row : accounts(txs, asOf).rows())
            if (row.daysSinceLast() >= DORMANT_DAYS)
                out.add(new Insight("DORMANT_ACCOUNT", "INFO", row.accountId(), row.accountName(), BigDecimal.valueOf(row.daysSinceLast()), row.lastDate()));
        if (!txs.isEmpty()) {
            LocalDate last = txs.get(txs.size() - 1).date();
            long idle = java.time.temporal.ChronoUnit.DAYS.between(last, asOf);
            if (idle >= IDLE_DAYS) out.add(new Insight("NO_RECENT_ACTIVITY", "INFO", null, null, BigDecimal.valueOf(idle), last));
            List<Tx> window = txs.stream().filter(t -> !t.date().isBefore(from)).toList();
            if (!window.isEmpty()) {
                EquityReport eq = equity(window, from, asOf);
                if (idle <= STREAK_FRESH_DAYS) { // an old streak is history, not news
                    if (eq.currentStreak() <= -STREAK_DAYS) out.add(new Insight("LOSING_STREAK", "WARN", null, null, BigDecimal.valueOf(-eq.currentStreak()), null));
                    if (eq.currentStreak() >= STREAK_DAYS) out.add(new Insight("WINNING_STREAK", "GOOD", null, null, BigDecimal.valueOf(eq.currentStreak()), null));
                }
                if (eq.currentDrawdown().signum() > 0 && eq.peakNet().signum() > 0) {
                    BigDecimal pct = eq.currentDrawdown().multiply(BigDecimal.valueOf(100)).divide(eq.peakNet(), 2, RoundingMode.HALF_UP);
                    if (pct.compareTo(BigDecimal.valueOf(25)) >= 0) out.add(new Insight("DEEP_DRAWDOWN", "WARN", null, null, pct, eq.maxDrawdownDate()));
                }
            }
            java.time.YearMonth month = java.time.YearMonth.from(asOf);
            BigDecimal monthNet = BigDecimal.ZERO;
            for (Tx t : txs) if (java.time.YearMonth.from(t.date()).equals(month)) monthNet = monthNet.add(signedNet(t));
            if (monthNet.signum() < 0) out.add(new Insight("NEGATIVE_MONTH", "WARN", null, null, monthNet, null));
            if (monthNet.signum() > 0) out.add(new Insight("POSITIVE_MONTH", "GOOD", null, null, monthNet, null));
            for (Kind k : Kind.values()) {
                List<Tx> same = window.stream().filter(t -> t.kind() == k).toList();
                if (same.size() < 5) continue;
                BigDecimal avg = same.stream().map(Tx::amount).reduce(BigDecimal.ZERO, BigDecimal::add).divide(BigDecimal.valueOf(same.size()), 4, RoundingMode.HALF_UP);
                for (Tx t : same)
                    if (!t.date().isBefore(asOf.minusDays(6)) && !t.date().isAfter(asOf) && t.amount().compareTo(avg.multiply(BigDecimal.valueOf(3))) >= 0)
                        out.add(new Insight("LARGE_TRANSACTION_" + k.name(), "INFO", t.accountId(), t.accountName(), t.amount(), t.date()));
            }
        }
        List<String> order = List.of("WARN", "INFO", "GOOD");
        out.sort(Comparator.comparingInt((Insight i) -> order.indexOf(i.severity())));
        return new InsightsReport(asOf, out);
    }

    /** Trading-style statistics over per-day net (active days only). Ratios are null when the denominator is zero. */
    static PerformanceReport performance(List<Tx> txs, LocalDate from, LocalDate to) {
        Map<LocalDate, BigDecimal> daily = dailyNet(txs);
        BigDecimal grossWin = BigDecimal.ZERO, grossLoss = BigDecimal.ZERO, largestWin = BigDecimal.ZERO, largestLoss = BigDecimal.ZERO, total = BigDecimal.ZERO;
        long wins = 0, losses = 0;
        for (BigDecimal v : daily.values()) {
            total = total.add(v);
            if (v.signum() > 0) { wins++; grossWin = grossWin.add(v); largestWin = largestWin.max(v); }
            else if (v.signum() < 0) { losses++; grossLoss = grossLoss.add(v.negate()); largestLoss = largestLoss.max(v.negate()); }
        }
        long active = daily.size();
        BigDecimal avgWin = wins == 0 ? BigDecimal.ZERO : grossWin.divide(BigDecimal.valueOf(wins), 4, RoundingMode.HALF_UP);
        BigDecimal avgLoss = losses == 0 ? BigDecimal.ZERO : grossLoss.divide(BigDecimal.valueOf(losses), 4, RoundingMode.HALF_UP);
        BigDecimal maxDd = drawdowns(txs, from, to).deepest();
        List<BigDecimal> sorted = daily.values().stream().sorted().toList();
        return new PerformanceReport(active, wins, losses, wins + losses == 0 ? null : ratio(BigDecimal.valueOf(wins), BigDecimal.valueOf(wins + losses)),
            grossWin, grossLoss, avgWin, avgLoss, avgLoss.signum() == 0 ? null : avgWin.divide(avgLoss, 2, RoundingMode.HALF_UP),
            grossLoss.signum() == 0 ? null : grossWin.divide(grossLoss, 2, RoundingMode.HALF_UP),
            active == 0 ? BigDecimal.ZERO : total.divide(BigDecimal.valueOf(active), 4, RoundingMode.HALF_UP),
            sorted.isEmpty() ? BigDecimal.ZERO : median(sorted), largestWin, largestLoss, total, maxDd,
            maxDd.signum() == 0 ? null : total.divide(maxDd, 2, RoundingMode.HALF_UP));
    }

    static final int LOT_LIMIT = 200;

    /**
     * FIFO capital recovery: every deposit is a lot, each withdrawal repays the oldest open lot first (bonuses are not
     * recovered cash; withdrawals beyond all open lots are profit). Outstanding capital is aged from its deposit date.
     */
    private static final class OpenLot {
        final Tx deposit;
        BigDecimal recovered = BigDecimal.ZERO;
        LocalDate recoveredDate;
        OpenLot(Tx deposit) { this.deposit = deposit; }
        BigDecimal room() { return deposit.amount().subtract(recovered); }
    }

    static LotsReport lots(List<Tx> txs, LocalDate asOf) {
        Map<Long, List<Tx>> byAccount = new LinkedHashMap<>();
        txs.forEach(t -> byAccount.computeIfAbsent(t.accountId(), k -> new ArrayList<>()).add(t));
        List<Lot> all = new ArrayList<>();
        for (List<Tx> list : byAccount.values()) {
            List<OpenLot> lots = new ArrayList<>();
            Deque<OpenLot> queue = new ArrayDeque<>();
            for (Tx t : list) {
                if (t.kind() == Kind.DEPOSIT) {
                    OpenLot lot = new OpenLot(t);
                    lots.add(lot);
                    queue.addLast(lot);
                } else if (t.kind() == Kind.WITHDRAWAL) {
                    BigDecimal left = t.amount();
                    while (left.signum() > 0 && !queue.isEmpty()) {
                        OpenLot lot = queue.peekFirst();
                        BigDecimal take = lot.room().min(left);
                        lot.recovered = lot.recovered.add(take);
                        left = left.subtract(take);
                        if (lot.room().signum() == 0) { lot.recoveredDate = t.date(); queue.pollFirst(); }
                    }
                }
            }
            for (OpenLot lot : lots) {
                LocalDate dep = lot.deposit.date();
                all.add(new Lot(lot.deposit.accountId(), lot.deposit.accountName(), dep, lot.deposit.amount(), lot.recovered, lot.room(), lot.recoveredDate,
                    lot.recoveredDate == null ? null : java.time.temporal.ChronoUnit.DAYS.between(dep, lot.recoveredDate),
                    java.time.temporal.ChronoUnit.DAYS.between(dep, asOf)));
            }
        }
        BigDecimal deposited = BigDecimal.ZERO, rec = BigDecimal.ZERO, outstanding = BigDecimal.ZERO;
        long recoveredLots = 0, days = 0;
        BigDecimal[] bucketSum = {BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO};
        long[] bucketCount = new long[3];
        for (Lot l : all) {
            deposited = deposited.add(l.amount());
            rec = rec.add(l.recovered());
            BigDecimal open = l.outstanding();
            if (l.recoveredDate() != null) { recoveredLots++; days += l.daysToRecover(); }
            if (open.signum() > 0) {
                outstanding = outstanding.add(open);
                int b = l.ageDays() <= 30 ? 0 : l.ageDays() <= 90 ? 1 : 2;
                bucketSum[b] = bucketSum[b].add(open);
                bucketCount[b]++;
            }
        }
        String[] names = {"0-30", "31-90", "91+"};
        List<AgingBucket> aging = new ArrayList<>();
        for (int i = 0; i < 3; i++) aging.add(new AgingBucket(names[i], bucketCount[i], bucketSum[i]));
        all.sort(Comparator.comparing(Lot::depositDate).reversed());
        boolean truncated = all.size() > LOT_LIMIT;
        return new LotsReport(all.size(), recoveredLots, avg(days, recoveredLots), deposited, rec, outstanding, aging, truncated,
            truncated ? new ArrayList<>(all.subList(0, LOT_LIMIT)) : all);
    }

    /** Capital still at risk per account = deposits not yet withdrawn (never negative); concentration from the HHI of those shares. */
    static AllocationReport allocation(List<Tx> txs) {
        Map<Long, List<Tx>> byAccount = new LinkedHashMap<>();
        txs.forEach(t -> byAccount.computeIfAbsent(t.accountId(), k -> new ArrayList<>()).add(t));
        record Acc(Long id, String name, BigDecimal deposits, BigDecimal withdrawals, BigDecimal open) { }
        List<Acc> accs = new ArrayList<>();
        BigDecimal totalDeposits = BigDecimal.ZERO, totalOpen = BigDecimal.ZERO;
        for (List<Tx> list : byAccount.values()) {
            Totals t = totals(list);
            BigDecimal open = t.deposits().subtract(t.withdrawals()).max(BigDecimal.ZERO);
            accs.add(new Acc(list.get(0).accountId(), list.get(0).accountName(), t.deposits(), t.withdrawals(), open));
            totalDeposits = totalDeposits.add(t.deposits());
            totalOpen = totalOpen.add(open);
        }
        List<AllocationRow> rows = new ArrayList<>();
        BigDecimal hhi = totalOpen.signum() == 0 ? null : BigDecimal.ZERO, top = BigDecimal.ZERO;
        for (Acc a : accs) {
            BigDecimal share = ratio(a.open(), totalOpen);
            if (share != null) { hhi = hhi.add(share.multiply(share)); top = top.max(share); }
            rows.add(new AllocationRow(a.id(), a.name(), a.deposits(), a.withdrawals(), a.open(), share, ratio(a.deposits(), totalDeposits)));
        }
        rows.sort(Comparator.comparing(AllocationRow::outstanding).reversed());
        if (hhi != null) hhi = hhi.setScale(0, RoundingMode.HALF_UP);
        // conventional antitrust bands: <1500 diversified, <2500 moderate, otherwise concentrated
        String level = hhi == null ? "NONE" : hhi.compareTo(BigDecimal.valueOf(1500)) < 0 ? "DIVERSIFIED" : hhi.compareTo(BigDecimal.valueOf(2500)) < 0 ? "MODERATE" : "CONCENTRATED";
        return new AllocationReport(totalDeposits, totalOpen, hhi, level, hhi == null ? null : top, rows);
    }
}
