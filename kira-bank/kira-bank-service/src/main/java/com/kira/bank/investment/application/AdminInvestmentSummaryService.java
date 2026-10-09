package com.kira.bank.investment.application;

import com.kira.bank.shared.web.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.*;

/** Platform-wide investment totals for administrators. Pure SQL aggregation; never loads individual rows. */
@Service
@RequiredArgsConstructor
public class AdminInvestmentSummaryService {
    private static final int MAX_RANGE_DAYS = 1830;
    private static final int TOP_USERS = 10;
    private final JdbcTemplate jdbc;

    @Value("${investment.transaction-import.time-zone:Asia/Ho_Chi_Minh}")
    private String timeZone;

    public record Totals(long transactions, long users, long accounts, BigDecimal deposits, BigDecimal withdrawals,
                         BigDecimal bonuses, BigDecimal net) {
    }

    public record MonthRow(String month, long transactions, BigDecimal deposits, BigDecimal withdrawals, BigDecimal bonuses,
                           BigDecimal net) {
    }

    public record UserRow(Long userId, String email, String fullName, long transactions, BigDecimal deposits,
                          BigDecimal withdrawals, BigDecimal net) {
    }

    public record CurrencySummary(String currency, Totals totals, List<MonthRow> months, List<UserRow> topUsers) {
    }

    public record Summary(LocalDate fromDate, LocalDate toDate, String timeZone, List<CurrencySummary> currencies) {
    }

    private static final String AMOUNTS = """
        coalesce(sum(case when t.transaction_type = 'DEPOSIT' then t.amount else 0 end),0) as deposits,
        coalesce(sum(case when t.transaction_type = 'WITHDRAWAL' then t.amount else 0 end),0) as withdrawals,
        coalesce(sum(case when t.transaction_type = 'BONUS' then t.amount else 0 end),0) as bonuses""";
    private static final String BASE = """
        from investment_account_transactions t
        join investment_accounts a on a.id = t.investment_account_id and a.user_id = t.user_id
        join users u on u.id = t.user_id
        where t.deleted_at is null and a.deleted_at is null and u.deleted_at is null and t.transaction_status = 'COMPLETED'
          and t.transaction_at >= ? and t.transaction_at < ?""";

    @Transactional(readOnly = true)
    public Summary summary(LocalDate fromDate, LocalDate toDate) {
        ZoneId zone = ZoneId.of(timeZone);
        LocalDate to = toDate == null ? LocalDate.now(zone) : toDate;
        LocalDate from = fromDate == null ? to.minusDays(364) : fromDate;
        if (from.isAfter(to)) throw bad("INVALID_REPORT_RANGE", "fromDate must be before or equal to toDate");
        if (ChronoUnit.DAYS.between(from, to) > MAX_RANGE_DAYS) throw bad("REPORT_RANGE_TOO_LARGE", "Date range cannot exceed 5 years");
        Timestamp start = Timestamp.from(from.atStartOfDay(zone).toInstant());
        Timestamp end = Timestamp.from(to.plusDays(1).atStartOfDay(zone).toInstant());
        Map<String, Totals> totals = new LinkedHashMap<>();
        jdbc.query("select t.currency, count(*) as n, count(distinct t.user_id) as users, count(distinct t.investment_account_id) as accounts, "
                + AMOUNTS + " " + BASE + " group by t.currency order by n desc, t.currency",
            rs -> { totals.put(rs.getString("currency"), totals(rs.getLong("n"), rs.getLong("users"), rs.getLong("accounts"), rs.getBigDecimal("deposits"),
                rs.getBigDecimal("withdrawals"), rs.getBigDecimal("bonuses"))); }, start, end);

        Map<String, List<MonthRow>> months = new HashMap<>();
        if (zone.getRules().isFixedOffset()) {
            int offset = zone.getRules().getOffset(java.time.Instant.now()).getTotalSeconds();
            jdbc.query("select t.currency, date_format(timestampadd(SECOND, ?, t.transaction_at), '%Y-%m') as month, count(*) as n, " + AMOUNTS
                    + " " + BASE + " group by t.currency, month order by month",
                rs -> { months.computeIfAbsent(rs.getString("currency"), k -> new ArrayList<>()).add(monthRow(rs.getString("month"), rs)); },
                offset, start, end);
        } else {
            // A DST zone has no single offset, so each calendar month is bucketed by its own local boundaries.
            for (java.time.YearMonth m = java.time.YearMonth.from(from); !m.isAfter(java.time.YearMonth.from(to)); m = m.plusMonths(1)) {
                Timestamp mStart = Timestamp.from(java.time.Instant.from(m.atDay(1).atStartOfDay(zone)));
                Timestamp mEnd = Timestamp.from(java.time.Instant.from(m.plusMonths(1).atDay(1).atStartOfDay(zone)));
                Timestamp lo = mStart.after(start) ? mStart : start, hi = mEnd.before(end) ? mEnd : end;
                String label = m.toString();
                jdbc.query("select t.currency, count(*) as n, " + AMOUNTS + " " + BASE + " group by t.currency",
                    rs -> { months.computeIfAbsent(rs.getString("currency"), k -> new ArrayList<>()).add(monthRow(label, rs)); }, lo, hi);
            }
        }

        // Rank per currency inside MySQL so only the top rows cross the wire.
        Map<String, List<UserRow>> users = new HashMap<>();
        jdbc.query("""
            select * from (
              select t.currency, t.user_id, u.email, u.full_name, count(*) as n, %s,
                     row_number() over (partition by t.currency order by coalesce(sum(case when t.transaction_type in ('DEPOSIT','WITHDRAWAL') then t.amount else 0 end),0) desc, t.user_id) as rank_in_currency
              %s group by t.currency, t.user_id, u.email, u.full_name) ranked
            where rank_in_currency <= %d order by currency, rank_in_currency""".formatted(AMOUNTS, BASE, TOP_USERS),
            rs -> { BigDecimal d = rs.getBigDecimal("deposits"), w = rs.getBigDecimal("withdrawals");
                users.computeIfAbsent(rs.getString("currency"), k -> new ArrayList<>()).add(new UserRow(rs.getLong("user_id"), rs.getString("email"),
                    rs.getString("full_name"), rs.getLong("n"), d, w, w.subtract(d))); },
            start, end);

        List<CurrencySummary> out = new ArrayList<>();
        totals.forEach((currency, t) -> out.add(new CurrencySummary(currency, t, months.getOrDefault(currency, List.of()), users.getOrDefault(currency, List.of()))));
        return new Summary(from, to, timeZone, out);
    }

    private static MonthRow monthRow(String month, java.sql.ResultSet rs) throws java.sql.SQLException {
        BigDecimal d = rs.getBigDecimal("deposits"), w = rs.getBigDecimal("withdrawals"), b = rs.getBigDecimal("bonuses");
        return new MonthRow(month, rs.getLong("n"), d, w, b, w.subtract(d));
    }

    private static Totals totals(long n, long users, long accounts, BigDecimal d, BigDecimal w, BigDecimal b) {
        return new Totals(n, users, accounts, d, w, b, w.subtract(d));
    }

    private static ApiException bad(String code, String message) { return new ApiException(HttpStatus.BAD_REQUEST, code, message); }
}
