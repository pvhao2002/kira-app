package com.kira.bank.investment.application;

import com.kira.bank.investment.application.InvestmentReportCalculator.Kind;
import com.kira.bank.investment.application.InvestmentReportCalculator.Tx;
import com.kira.bank.investment.application.InvestmentReportDtos.*;
import com.kira.bank.shared.web.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.function.BiFunction;
import java.util.function.Function;

@Service
@RequiredArgsConstructor
public class InvestmentReportService {
    private static final int MAX_RANGE_DAYS = 1830;
    private static final int MAX_GOALS = 20;
    private static final Set<String> GRANULARITIES = Set.of("DAY", "WEEK", "MONTH", "QUARTER", "YEAR");
    private final JdbcTemplate jdbc;

    @Value("${investment.transaction-import.time-zone:Asia/Ho_Chi_Minh}")
    private String timeZone;

    public Report<?> report(String type, Long userId, Long accountId, LocalDate from, LocalDate to, String granularity) {
        return report(type, userId, accountId, from, to, granularity, null, null);
    }

    @Transactional(readOnly = true)
    public Report<?> report(String type, Long userId, Long accountId, LocalDate from, LocalDate to, String granularity,
                            LocalDate compareFrom, LocalDate compareTo) {
        return switch (type.toLowerCase(Locale.ROOT)) {
            case "periodic" -> periodic(userId, accountId, from, to, granularity);
            case "accounts" -> accounts(userId, accountId, from, to);
            case "equity" -> equity(userId, accountId, from, to);
            case "rolling" -> rolling(userId, accountId, from, to);
            case "daily" -> daily(userId, accountId, from, to);
            case "activity" -> activity(userId, accountId, from, to);
            case "distribution" -> distribution(userId, accountId, from, to);
            case "bonus" -> bonus(userId, accountId, from, to);
            case "comparison" -> comparison(userId, accountId, from, to, compareFrom, compareTo);
            case "performance" -> performance(userId, accountId, from, to);
            case "insights" -> insights(userId, accountId, from, to);
            case "goals" -> goals(userId, accountId, from, to);
            case "overview" -> overview(userId, accountId, from, to);
            case "matrix" -> matrix(userId, accountId, from, to);
            case "drawdowns" -> drawdowns(userId, accountId, from, to);
            case "cadence" -> cadence(userId, accountId, from, to);
            case "ledger" -> ledger(userId, accountId, from, to);
            case "allocation" -> allocation(userId, accountId, from, to);
            case "lots" -> lots(userId, accountId, from, to);
            case "payback" -> payback(userId, accountId, from, to);
            case "seasonality" -> seasonality(userId, accountId, from, to);
            case "projection" -> projection(userId, accountId, from, to);
            default -> throw new ApiException(HttpStatus.NOT_FOUND, "INVESTMENT_REPORT_TYPE_NOT_FOUND", "Không tìm thấy báo cáo");
        };
    }

    @Transactional(readOnly = true)
    public Report<PeriodicReport> periodic(Long userId, Long accountId, LocalDate from, LocalDate to, String granularity) {
        String g = granularity == null ? "MONTH" : granularity.toUpperCase(Locale.ROOT);
        if (!GRANULARITIES.contains(g)) throw bad("INVALID_REPORT_GRANULARITY", "Unsupported granularity");
        Range r = range(from, to, 365);
        return build("PERIODIC", userId, accountId, r.from, r.to, 365, txs -> InvestmentReportCalculator.periodic(txs, g, r.from, r.to));
    }

    @Transactional(readOnly = true)
    public Report<AccountsReport> accounts(Long userId, Long accountId, LocalDate from, LocalDate to) {
        LocalDate asOf = to == null ? LocalDate.now(ZoneId.of(timeZone)) : to;
        return build("ACCOUNTS", userId, accountId, from, to, 365, txs -> InvestmentReportCalculator.accounts(txs, asOf));
    }

    @Transactional(readOnly = true)
    public Report<EquityReport> equity(Long userId, Long accountId, LocalDate from, LocalDate to) {
        Range r = range(from, to, 90);
        return build("EQUITY", userId, accountId, r.from, r.to, 90, txs -> InvestmentReportCalculator.equity(txs, r.from, r.to));
    }

    @Transactional(readOnly = true)
    public Report<ActivityReport> activity(Long userId, Long accountId, LocalDate from, LocalDate to) {
        return build("ACTIVITY", userId, accountId, from, to, 90, InvestmentReportCalculator::activity);
    }

    @Transactional(readOnly = true)
    public Report<DistributionReport> distribution(Long userId, Long accountId, LocalDate from, LocalDate to) {
        return build("DISTRIBUTION", userId, accountId, from, to, 90, InvestmentReportCalculator::distribution);
    }

    public Report<ComparisonReport> comparison(Long userId, Long accountId, LocalDate from, LocalDate to) {
        return comparison(userId, accountId, from, to, null, null);
    }

    /** Compares [from, to] with [compareFrom, compareTo], or with the immediately preceding window of equal length when omitted. */
    @Transactional(readOnly = true)
    public Report<ComparisonReport> comparison(Long userId, Long accountId, LocalDate from, LocalDate to,
                                               LocalDate compareFrom, LocalDate compareTo) {
        Range r = range(from, to, 30);
        verifyAccount(userId, accountId);
        LocalDate prevFrom, prevTo;
        if (compareFrom != null || compareTo != null) {
            if (compareFrom == null || compareTo == null) throw bad("INVALID_REPORT_RANGE", "compareFrom and compareTo must be given together");
            Range c = range(compareFrom, compareTo, 30);
            prevFrom = c.from;
            prevTo = c.to;
        } else {
            long days = java.time.temporal.ChronoUnit.DAYS.between(r.from, r.to) + 1;
            prevTo = r.from.minusDays(1);
            prevFrom = prevTo.minusDays(days - 1);
        }
        Map<String, List<Tx>> previous = load(userId, accountId, prevFrom, prevTo);
        LocalDate pf = prevFrom, pt = prevTo;
        return build("COMPARISON", userId, accountId, r.from, r.to, 30, (currency, txs) -> InvestmentReportCalculator
            .comparison(txs, previous.getOrDefault(currency, List.of()), pf, pt), previous.keySet());
    }

    @Transactional(readOnly = true)
    public Report<DailyReport> daily(Long userId, Long accountId, LocalDate from, LocalDate to) {
        return build("DAILY", userId, accountId, from, to, 90, InvestmentReportCalculator::daily);
    }

    @Transactional(readOnly = true)
    public Report<RollingReport> rolling(Long userId, Long accountId, LocalDate from, LocalDate to) {
        Range r = range(from, to, 90);
        return build("ROLLING", userId, accountId, r.from, r.to, 90, txs -> InvestmentReportCalculator.rolling(txs, r.from, r.to));
    }

    @Transactional(readOnly = true)
    public Report<BonusReport> bonus(Long userId, Long accountId, LocalDate from, LocalDate to) {
        return build("BONUS", userId, accountId, from, to, 365, InvestmentReportCalculator::bonus);
    }

    @Transactional(readOnly = true)
    public Report<PaybackReport> payback(Long userId, Long accountId, LocalDate from, LocalDate to) {
        return build("PAYBACK", userId, accountId, from, to, MAX_RANGE_DAYS, InvestmentReportCalculator::payback);
    }

    @Transactional(readOnly = true)
    public Report<SeasonalityReport> seasonality(Long userId, Long accountId, LocalDate from, LocalDate to) {
        return build("SEASONALITY", userId, accountId, from, to, 730, InvestmentReportCalculator::seasonality);
    }

    @Transactional(readOnly = true)
    public Report<ProjectionReport> projection(Long userId, Long accountId, LocalDate from, LocalDate to) {
        Range r = range(from, to, 90);
        // month-to-date and trailing windows are measured at toDate whatever fromDate was sent
        LocalDate monthStart = r.to.withDayOfMonth(1), trailing = r.to.minusDays(89);
        LocalDate loadFrom = monthStart.isBefore(trailing) ? monthStart : trailing;
        LocalDate firstEver = firstTransactionDate(userId, accountId);
        return build("PROJECTION", userId, accountId, loadFrom, r.to, 90, txs -> InvestmentReportCalculator.projection(txs, r.to, firstEver));
    }

    @Transactional(readOnly = true)
    public Report<LedgerReport> ledger(Long userId, Long accountId, LocalDate from, LocalDate to) {
        return build("LEDGER", userId, accountId, from, to, 30, InvestmentReportCalculator::ledger);
    }

    @Transactional(readOnly = true)
    public Report<OverviewReport> overview(Long userId, Long accountId, LocalDate from, LocalDate to) {
        Range r = range(from, to, 365);
        return build("OVERVIEW", userId, accountId, r.from, r.to, 365, txs -> InvestmentReportCalculator.overview(txs, r.to));
    }

    @Transactional(readOnly = true)
    public Report<MatrixReport> matrix(Long userId, Long accountId, LocalDate from, LocalDate to) {
        Range r = range(from, to, 365);
        return build("MATRIX", userId, accountId, r.from, r.to, 365, txs -> InvestmentReportCalculator.matrix(txs, r.from, r.to));
    }

    @Transactional(readOnly = true)
    public Report<DrawdownReport> drawdowns(Long userId, Long accountId, LocalDate from, LocalDate to) {
        Range r = range(from, to, 365);
        return build("DRAWDOWNS", userId, accountId, r.from, r.to, 365, txs -> InvestmentReportCalculator.drawdowns(txs, r.from, r.to));
    }

    @Transactional(readOnly = true)
    public Report<CadenceReport> cadence(Long userId, Long accountId, LocalDate from, LocalDate to) {
        return build("CADENCE", userId, accountId, from, to, 365, InvestmentReportCalculator::cadence);
    }

    @Transactional(readOnly = true)
    public Report<GoalsReport> goals(Long userId, Long accountId, LocalDate from, LocalDate to) {
        LocalDate asOf = to == null ? LocalDate.now(ZoneId.of(timeZone)) : to;
        verifyAccount(userId, accountId); // same 404 as every other report, even though the filter is not applied
        // Goals belong to the user and currency, so progress always spans every account (accountId is accepted but ignored).
        Map<String, List<Goal>> byCurrency = new TreeMap<>();
        listGoals(userId).forEach(g -> byCurrency.computeIfAbsent(g.currency(), k -> new ArrayList<>()).add(g));
        // goals always measure the calendar year containing asOf, whatever range the client sent
        return build("GOALS", userId, null, asOf.withDayOfYear(1), asOf, 365,
            (currency, txs) -> InvestmentReportCalculator.goals(txs, byCurrency.getOrDefault(currency, List.of()), asOf), byCurrency.keySet());
    }

    @Transactional(readOnly = true)
    public List<Goal> listGoals(Long userId) {
        return jdbc.query("select id, currency, period, target_amount from investment_goals where user_id = ? order by currency, period",
            (rs, n) -> new Goal(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getBigDecimal(4)), userId);
    }

    @Transactional
    public Goal saveGoal(Long userId, GoalRequest request) {
        String currency = request.currency().toUpperCase(Locale.ROOT);
        if (jdbc.queryForObject("select count(*) from investment_accounts where user_id = ? and currency = ? and deleted_at is null", Long.class, userId, currency) == 0)
            throw bad("INVALID_GOAL_CURRENCY", "The user has no investment account in this currency");
        if (jdbc.queryForObject("select count(*) from investment_goals where user_id = ?", Long.class, userId) >= MAX_GOALS
            && jdbc.queryForObject("select count(*) from investment_goals where user_id = ? and currency = ? and period = ?", Long.class, userId, currency, request.period()) == 0)
            throw bad("TOO_MANY_GOALS", "Goal limit reached");
        jdbc.update("""
            insert into investment_goals(user_id, currency, period, target_amount) values (?,?,?,?)
            on duplicate key update target_amount = values(target_amount)""", userId, currency, request.period(), request.targetAmount());
        return jdbc.queryForObject("select id, currency, period, target_amount from investment_goals where user_id = ? and currency = ? and period = ?",
            (rs, n) -> new Goal(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getBigDecimal(4)), userId, currency, request.period());
    }

    @Transactional
    public void deleteGoal(Long userId, Long goalId) {
        if (jdbc.update("delete from investment_goals where id = ? and user_id = ?", goalId, userId) == 0)
            throw new ApiException(HttpStatus.NOT_FOUND, "INVESTMENT_GOAL_NOT_FOUND", "Không tìm thấy dữ liệu");
    }

    @Transactional(readOnly = true)
    public Report<InsightsReport> insights(Long userId, Long accountId, LocalDate from, LocalDate to) {
        Range r = range(from, to, 90);
        // dormancy / idle checks need history from before the window
        LocalDate loadFrom = r.from.isBefore(r.to.minusDays(365)) ? r.from : r.to.minusDays(365);
        return build("INSIGHTS", userId, accountId, loadFrom, r.to, 90, txs -> InvestmentReportCalculator.insights(txs, r.from, r.to));
    }

    @Transactional(readOnly = true)
    public Report<PerformanceReport> performance(Long userId, Long accountId, LocalDate from, LocalDate to) {
        Range r = range(from, to, 365);
        return build("PERFORMANCE", userId, accountId, r.from, r.to, 365, txs -> InvestmentReportCalculator.performance(txs, r.from, r.to));
    }

    @Transactional(readOnly = true)
    public Report<LotsReport> lots(Long userId, Long accountId, LocalDate from, LocalDate to) {
        Range r = range(from, to, MAX_RANGE_DAYS);
        return build("LOTS", userId, accountId, r.from, r.to, MAX_RANGE_DAYS, txs -> InvestmentReportCalculator.lots(txs, r.to));
    }

    @Transactional(readOnly = true)
    public Report<AllocationReport> allocation(Long userId, Long accountId, LocalDate from, LocalDate to) {
        return build("ALLOCATION", userId, accountId, from, to, MAX_RANGE_DAYS, InvestmentReportCalculator::allocation);
    }

    private record Range(LocalDate from, LocalDate to) { }

    private Range range(LocalDate fromDate, LocalDate toDate, int defaultDays) {
        LocalDate to = toDate == null ? LocalDate.now(ZoneId.of(timeZone)) : toDate;
        LocalDate from = fromDate == null ? to.minusDays(defaultDays - 1L) : fromDate;
        if (from.isAfter(to)) throw bad("INVALID_REPORT_RANGE", "fromDate must be before or equal to toDate");
        if (java.time.temporal.ChronoUnit.DAYS.between(from, to) > MAX_RANGE_DAYS) throw bad("REPORT_RANGE_TOO_LARGE", "Date range cannot exceed 5 years");
        return new Range(from, to);
    }

    private <T> Report<T> build(String type, Long userId, Long accountId, LocalDate fromDate, LocalDate toDate,
                                int defaultDays, Function<List<Tx>, T> calc) {
        return build(type, userId, accountId, fromDate, toDate, defaultDays, (currency, txs) -> calc.apply(txs), Set.of());
    }

    private <T> Report<T> build(String type, Long userId, Long accountId, LocalDate fromDate, LocalDate toDate,
                                int defaultDays, BiFunction<String, List<Tx>, T> calc, Set<String> extraCurrencies) {
        Range r = range(fromDate, toDate, defaultDays);
        LocalDate from = r.from, to = r.to;
        verifyAccount(userId, accountId);
        Map<String, List<Tx>> byCurrency = new TreeMap<>(load(userId, accountId, from, to));
        extraCurrencies.forEach(c -> byCurrency.computeIfAbsent(c, k -> new ArrayList<>()));
        // Busiest currency first so clients that open the first entry land on the user's main currency.
        List<Map.Entry<String, List<Tx>>> ordered = new ArrayList<>(byCurrency.entrySet());
        ordered.sort(Comparator.comparingInt((Map.Entry<String, List<Tx>> e) -> e.getValue().size()).reversed());
        List<CurrencyReport<T>> currencies = new ArrayList<>();
        ordered.forEach(e -> currencies.add(new CurrencyReport<>(e.getKey(), calc.apply(e.getKey(), e.getValue()))));
        return new Report<>(type, from, to, timeZone, accountId, currencies);
    }

    private LocalDate firstTransactionDate(Long userId, Long accountId) {
        Timestamp first = jdbc.queryForObject("""
            select min(t.transaction_at) from investment_account_transactions t
            join investment_accounts a on a.id = t.investment_account_id and a.user_id = t.user_id
            where t.user_id = ? and t.deleted_at is null and a.deleted_at is null and t.transaction_status = 'COMPLETED'
              and (? is null or t.investment_account_id = ?)""", Timestamp.class, userId, accountId, accountId);
        return first == null ? null : first.toInstant().atZone(ZoneId.of(timeZone)).toLocalDate();
    }

    private Map<String, List<Tx>> load(Long userId, Long accountId, LocalDate from, LocalDate to) {
        ZoneId zone = ZoneId.of(timeZone);
        List<Tx> all = jdbc.query("""
            select t.investment_account_id, a.account_name, t.currency, t.transaction_type, t.amount, t.transaction_at
            from investment_account_transactions t
            join investment_accounts a on a.id = t.investment_account_id and a.user_id = t.user_id
            where t.user_id = ? and t.deleted_at is null and a.deleted_at is null
              and t.transaction_status = 'COMPLETED' and t.transaction_at >= ? and t.transaction_at < ?
              and (? is null or t.investment_account_id = ?)
            order by t.transaction_at, t.id
            """, (rs, n) -> new Tx(rs.getLong(1), rs.getString(2), rs.getString(3), Kind.valueOf(rs.getString(4)),
                rs.getBigDecimal(5), rs.getTimestamp(6).toInstant().atZone(zone)),
            userId, Timestamp.from(from.atStartOfDay(zone).toInstant()), Timestamp.from(to.plusDays(1).atStartOfDay(zone).toInstant()),
            accountId, accountId);
        Map<String, List<Tx>> byCurrency = new TreeMap<>();
        all.forEach(t -> byCurrency.computeIfAbsent(t.currency(), k -> new ArrayList<>()).add(t));
        return byCurrency;
    }

    private void verifyAccount(Long userId, Long accountId) {
        if (accountId != null && jdbc.queryForObject("select count(*) from investment_accounts where id = ? and user_id = ? and deleted_at is null", Long.class, accountId, userId) == 0) {
            throw new ApiException(HttpStatus.NOT_FOUND, "INVESTMENT_ACCOUNT_NOT_FOUND", "Không tìm thấy dữ liệu");
        }
    }

    private static ApiException bad(String code, String message) { return new ApiException(HttpStatus.BAD_REQUEST, code, message); }
}
