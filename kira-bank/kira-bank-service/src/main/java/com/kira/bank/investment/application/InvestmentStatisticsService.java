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
import java.time.*;
import java.util.*;

import static com.kira.bank.investment.application.InvestmentStatisticsDtos.*;

@Service
@RequiredArgsConstructor
public class InvestmentStatisticsService {
    private static final Set<String> AI_STATUSES = Set.of("PENDING", "PROCESSING", "READY", "FAILED");
    private static final Set<String> REVIEW_STATUSES = Set.of("READY", "READY_WITH_ERRORS", "PARTIALLY_CONFIRMED");
    private final JdbcTemplate jdbc;

    @Value("${investment.transaction-import.time-zone:Asia/Ho_Chi_Minh}")
    private String timeZone;

    @Transactional(readOnly = true)
    public OverviewResponse overview(Long userId, Long accountId, LocalDate fromDate, LocalDate toDate) {
        ZoneId zone = ZoneId.of(timeZone);
        LocalDate today = LocalDate.now(zone);
        LocalDate from = fromDate == null ? today.minusDays(29) : fromDate;
        LocalDate to = toDate == null ? today : toDate;
        if (from.isAfter(to)) throw bad("INVALID_STATISTICS_RANGE", "fromDate must be before or equal to toDate");
        if (from.plusDays(365).isBefore(to)) throw bad("STATISTICS_RANGE_TOO_LARGE", "Date range cannot exceed 366 days");
        Instant start = from.atStartOfDay(zone).toInstant();
        Instant end = to.plusDays(1).atStartOfDay(zone).toInstant();
        Long accountFilter = accountId;
        verifyAccount(userId, accountId);

        List<AccountSummary> accounts = jdbc.query("""
            select a.id, a.account_name, a.account_code, a.currency, a.status,
              count(t.id) as total_count,
              coalesce(sum(case when t.transaction_type = 'DEPOSIT' then t.amount else 0 end),0) as deposits,
              coalesce(sum(case when t.transaction_type = 'WITHDRAWAL' then t.amount else 0 end),0) as withdrawals,
              coalesce(sum(case when t.transaction_type = 'BONUS' then t.amount else 0 end),0) as bonuses
            from investment_accounts a
            left join investment_account_transactions t on t.investment_account_id = a.id
              and t.user_id = a.user_id and t.deleted_at is null and t.transaction_status = 'COMPLETED'
              and t.transaction_at >= ? and t.transaction_at < ?
            where a.user_id = ? and a.deleted_at is null and (? is null or a.id = ?)
            group by a.id, a.account_name, a.account_code, a.currency, a.status
            order by a.account_name, a.id
            """, (rs, row) -> {
                BigDecimal deposits = decimal(rs.getBigDecimal("deposits"));
                BigDecimal withdrawals = decimal(rs.getBigDecimal("withdrawals"));
                BigDecimal bonuses = decimal(rs.getBigDecimal("bonuses"));
                return new AccountSummary(rs.getLong("id"), rs.getString("account_name"), rs.getString("account_code"),
                    rs.getString("currency"), rs.getString("status"), rs.getLong("total_count"), deposits,
                    withdrawals, bonuses, deposits.add(bonuses).subtract(withdrawals));
            }, Timestamp.from(start), Timestamp.from(end), userId, accountFilter, accountFilter);

        List<FlowRow> rows = jdbc.query("""
            select t.currency, date(timestampadd(SECOND, unix_timestamp(t.transaction_at) + ?, '1970-01-01')) as flow_date,
              count(t.id) as total_count,
              coalesce(sum(case when t.transaction_type = 'DEPOSIT' then t.amount else 0 end),0) as deposits,
              coalesce(sum(case when t.transaction_type = 'WITHDRAWAL' then t.amount else 0 end),0) as withdrawals,
              coalesce(sum(case when t.transaction_type = 'BONUS' then t.amount else 0 end),0) as bonuses
            from investment_account_transactions t
            join investment_accounts a on a.id = t.investment_account_id and a.user_id = t.user_id
            where t.user_id = ? and t.deleted_at is null and a.deleted_at is null
              and t.transaction_status = 'COMPLETED' and t.transaction_at >= ? and t.transaction_at < ?
              and (? is null or t.investment_account_id = ?)
            group by t.currency, flow_date order by t.currency, flow_date
            """, (rs, row) -> new FlowRow(rs.getString("currency"), rs.getDate("flow_date").toLocalDate(),
                rs.getLong("total_count"), decimal(rs.getBigDecimal("deposits")), decimal(rs.getBigDecimal("withdrawals")),
                decimal(rs.getBigDecimal("bonuses"))), zone.getRules().getOffset(Instant.now()).getTotalSeconds(),
            userId, Timestamp.from(start), Timestamp.from(end), accountFilter, accountFilter);

        Map<String, Map<LocalDate, FlowRow>> byCurrency = new TreeMap<>();
        accounts.forEach(account -> byCurrency.computeIfAbsent(account.currency(), _ -> new HashMap<>()));
        rows.forEach(row -> byCurrency.computeIfAbsent(row.currency(), _ -> new HashMap<>()).put(row.date(), row));
        List<CurrencySummary> currencies = new ArrayList<>();
        for (Map.Entry<String, Map<LocalDate, FlowRow>> entry : byCurrency.entrySet()) {
            BigDecimal deposits = BigDecimal.ZERO, withdrawals = BigDecimal.ZERO, bonuses = BigDecimal.ZERO;
            long count = 0;
            List<DailyFlow> daily = new ArrayList<>();
            for (LocalDate date = from; !date.isAfter(to); date = date.plusDays(1)) {
                FlowRow row = entry.getValue().get(date);
                BigDecimal dayDeposits = row == null ? BigDecimal.ZERO : row.deposits();
                BigDecimal dayWithdrawals = row == null ? BigDecimal.ZERO : row.withdrawals();
                BigDecimal dayBonuses = row == null ? BigDecimal.ZERO : row.bonuses();
                deposits = deposits.add(dayDeposits); withdrawals = withdrawals.add(dayWithdrawals); bonuses = bonuses.add(dayBonuses);
                count += row == null ? 0 : row.count();
                daily.add(new DailyFlow(date, dayDeposits, dayWithdrawals, dayBonuses));
            }
            currencies.add(new CurrencySummary(entry.getKey(), count, deposits, withdrawals, bonuses,
                deposits.add(bonuses).subtract(withdrawals), daily));
        }
        return new OverviewResponse(Instant.now(), timeZone, accountId, from, to, currencies, accounts);
    }

    @Transactional(readOnly = true)
    public OperationsResponse operations(Long userId, Long accountId) {
        Long accountFilter = accountId;
        verifyAccount(userId, accountId);
        String aiSql = """
            select a.ai_status, count(distinct a.id) as total
            from attachments a join investment_transaction_import_files f on f.attachment_id = a.id
            join investment_accounts acc on acc.id = f.investment_account_id
            where acc.user_id = ? and a.module = 'investment' and a.document_type = 'RECEIPT'
              and a.deleted_at is null and f.deleted_at is null and acc.deleted_at is null
              and a.storage_purged_at is null
              and (? is null or f.investment_account_id = ?)
            group by a.ai_status
            """;
        Map<String, Long> ai = new HashMap<>();
        jdbc.query(aiSql, (org.springframework.jdbc.core.RowCallbackHandler) rs -> ai.put(rs.getString("ai_status"), rs.getLong("total")), userId, accountFilter, accountFilter);
        String reviewFrom = " from investment_transaction_import_items i join investment_accounts acc on acc.id = i.investment_account_id "
            + "where acc.user_id = ? and acc.deleted_at is null and i.deleted_at is null and i.confirmed_transaction_id is null "
            + "and (i.resolution is null or i.resolution <> 'SKIP') and (? is null or i.investment_account_id = ?)";
        long reviewTotal = jdbc.queryForObject("select count(distinct acc.id)" + reviewFrom, Long.class, userId, accountFilter, accountFilter);
        List<ImportItem> reviewItems = jdbc.query("select acc.id, acc.account_name, min(i.created_at) as created_at, count(*) as review_count" + reviewFrom
            + " group by acc.id, acc.account_name order by 3 asc, acc.id asc limit 5", (rs, row) -> new ImportItem(rs.getLong("id"),
            rs.getString("account_name"), rs.getTimestamp("created_at").toInstant(), rs.getLong("review_count")), userId, accountFilter, accountFilter);
        return new OperationsResponse(Instant.now(), accountId,
            new AiSummary(ai.getOrDefault("PENDING", 0L), ai.getOrDefault("PROCESSING", 0L), ai.getOrDefault("READY", 0L), ai.getOrDefault("FAILED", 0L)),
            new ImportSummary(reviewTotal, reviewItems));
    }

    private static BigDecimal decimal(BigDecimal value) { return value == null ? BigDecimal.ZERO : value; }
    private void verifyAccount(Long userId, Long accountId) {
        if (accountId != null && jdbc.queryForObject("select count(*) from investment_accounts where id = ? and user_id = ? and deleted_at is null", Long.class, accountId, userId) == 0) {
            throw new ApiException(HttpStatus.NOT_FOUND, "INVESTMENT_ACCOUNT_NOT_FOUND", "Không tìm thấy dữ liệu");
        }
    }
    private static ApiException bad(String code, String message) { return new ApiException(HttpStatus.BAD_REQUEST, code, message); }
    private record FlowRow(String currency, LocalDate date, long count, BigDecimal deposits, BigDecimal withdrawals, BigDecimal bonuses) { }
}
