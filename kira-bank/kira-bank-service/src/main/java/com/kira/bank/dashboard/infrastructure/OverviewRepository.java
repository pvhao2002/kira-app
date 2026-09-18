package com.kira.bank.dashboard.infrastructure;

import com.kira.bank.shared.web.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;

import static com.kira.bank.dashboard.application.OverviewDtos.*;

@Repository
@RequiredArgsConstructor
public class OverviewRepository {
    private final JdbcTemplate jdbc;
    @Value("${investment.transaction-import.time-zone:Asia/Ho_Chi_Minh}")
    private String transactionImportTimeZone;

    public Group<Due> dues(Long userId, String condition, Object... dates) {
        String from = """
            from statements s join user_credit_cards c on c.id = s.user_card_id and c.user_id = s.user_id
            join banks b on b.id = c.bank_id
            where s.user_id = ? and s.deleted_at is null and c.deleted_at is null and
            """ + condition;
        List<Object> args = new ArrayList<>();
        args.add(userId);
        for (Object date : dates) args.add(java.sql.Date.valueOf((LocalDate) date));
        long count = Objects.requireNonNull(jdbc.queryForObject("select count(*) " + from, Long.class, args.toArray()));
        List<Due> rows = jdbc.query("""
            select s.id, c.id as card_id, coalesce(nullif(b.short_name,''),b.name) as bank_name,
                   c.nickname, c.last_four, s.due_date, s.remaining_amount, c.currency
            """ + from + " order by s.due_date asc, s.id asc limit 5", (rs, row) -> new Due(
            rs.getLong("id"), rs.getLong("card_id"), rs.getString("bank_name"), rs.getString("nickname"),
            rs.getString("last_four"), rs.getDate("due_date") == null ? null : rs.getDate("due_date").toLocalDate(),
            rs.getBigDecimal("remaining_amount"), rs.getString("currency")), args.toArray());
        return new Group<>(count, rows);
    }

    public Investments investments(Long userId, int days) {
        if (days != 7 && days != 30 && days != 90) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_OVERVIEW_PERIOD", "Period must be 7, 30 or 90 days");
        }
        ZoneId zone = ZoneId.of(transactionImportTimeZone);
        LocalDate today = LocalDate.now(zone), from = today.minusDays(days - 1L);
        var daily = jdbc.query("""
                select t.currency, date(timestampadd(SECOND, unix_timestamp(t.transaction_at) + ?, '1970-01-01')) as flow_date,
                  coalesce(sum(case when t.transaction_type = 'DEPOSIT' then t.amount else 0 end),0) as deposits,
                  coalesce(sum(case when t.transaction_type = 'WITHDRAWAL' then t.amount else 0 end),0) as withdrawals,
                  coalesce(sum(case when t.transaction_type = 'BONUS' then t.amount else 0 end),0) as bonuses
                from investment_account_transactions t
                join investment_accounts a on a.id = t.investment_account_id and a.user_id = t.user_id
                where t.user_id = ? and t.deleted_at is null and a.deleted_at is null
                  and t.transaction_status = 'COMPLETED' and t.transaction_at >= ? and t.transaction_at < ?
                group by t.currency, flow_date order by t.currency, flow_date
                """, (rs, row) -> new FlowRow(rs.getString("currency"), rs.getDate("flow_date").toLocalDate(),
                rs.getBigDecimal("deposits"), rs.getBigDecimal("withdrawals"), rs.getBigDecimal("bonuses")),
            userId, zone.getRules().getOffset(Instant.now()).getTotalSeconds(),
            Timestamp.from(from.atStartOfDay(zone).toInstant()), Timestamp.from(today.plusDays(1).atStartOfDay(zone).toInstant()));
        Set<String> currencies = new TreeSet<>(jdbc.queryForList(
            "select distinct currency from investment_accounts where user_id = ? and deleted_at is null and status = 'ACTIVE'",
            String.class, userId));
        daily.forEach(row -> currencies.add(row.currency()));
        List<CurrencyFlow> flows = new ArrayList<>();
        for (String currency : currencies) {
            Map<LocalDate, FlowRow> byDate = new HashMap<>();
            daily.stream().filter(row -> row.currency().equals(currency)).forEach(row -> byDate.put(row.date(), row));
            BigDecimal deposits = BigDecimal.ZERO, withdrawals = BigDecimal.ZERO, bonuses = BigDecimal.ZERO;
            List<DailyFlow> points = new ArrayList<>();
            for (LocalDate date = from; !date.isAfter(today); date = date.plusDays(1)) {
                FlowRow row = byDate.getOrDefault(date, new FlowRow(currency, date, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO));
                deposits = deposits.add(row.deposits());
                withdrawals = withdrawals.add(row.withdrawals());
                bonuses = bonuses.add(row.bonuses());
                points.add(new DailyFlow(date, row.deposits(), row.withdrawals(), row.bonuses()));
            }
            flows.add(new CurrencyFlow(currency, deposits, withdrawals, bonuses, deposits.add(bonuses).subtract(withdrawals), points));
        }
        long accounts = Objects.requireNonNull(jdbc.queryForObject(
            "select count(*) from investment_accounts where user_id = ? and deleted_at is null and status = 'ACTIVE'", Long.class, userId));
        return new Investments(Instant.now(), days, from, today, accounts, flows,
            imports(userId, "b.status in ('READY','READY_WITH_ERRORS','PARTIALLY_CONFIRMED')"),
            imports(userId, "b.status = 'FAILED'"));
    }

    private Group<ImportTask> imports(Long userId, String condition) {
        String from = """
            from investment_transaction_import_batches b
            join investment_accounts a on a.id = b.investment_account_id and a.user_id = b.user_id
            where b.user_id = ? and b.deleted_at is null and a.deleted_at is null and
            """ + condition;
        long count = Objects.requireNonNull(jdbc.queryForObject("select count(*) " + from, Long.class, userId));
        var rows = jdbc.query("select b.batch_id, b.investment_account_id, a.account_name, b.status " + from
                + " order by b.created_at asc, b.id asc limit 5",
            (rs, row) -> new ImportTask(rs.getString("batch_id"), rs.getLong("investment_account_id"),
                rs.getString("account_name"), rs.getString("status")), userId);
        return new Group<>(count, rows);
    }

    private record FlowRow(String currency, LocalDate date, BigDecimal deposits, BigDecimal withdrawals,
                           BigDecimal bonuses) {
    }
}
