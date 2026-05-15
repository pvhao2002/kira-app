package com.db.kiragateway.credit;

import com.db.kiragateway.config.db.ReadDB;
import com.db.kiragateway.config.db.WriteDB;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Repository
public class CreditCardRepository {

    private final NamedParameterJdbcTemplate readJdbc;
    private final NamedParameterJdbcTemplate writeJdbc;

    public CreditCardRepository(@ReadDB NamedParameterJdbcTemplate readJdbc,
                                @WriteDB NamedParameterJdbcTemplate writeJdbc) {
        this.readJdbc = readJdbc;
        this.writeJdbc = writeJdbc;
    }

    public CreditCardSummaryAgg summary(int userId) {
        var sql = """
                select coalesce(sum(outstanding_balance), 0) as total,
                       count(*) as cnt
                from credit_cards
                where user_id = :userId
                """;
        return readJdbc.queryForObject(sql, new MapSqlParameterSource("userId", userId), (rs, rn) -> {
            BigDecimal total = rs.getBigDecimal("total");
            if (total == null) {
                total = BigDecimal.ZERO;
            }
            return new CreditCardSummaryAgg(total, rs.getLong("cnt"));
        });
    }

    public List<CreditCardRow> findAllByUserId(int userId) {
        var sql = """
                select credit_card_id, user_id, bank_name, card_label, last_four, credit_limit, outstanding_balance,
                       cardholder_name, statement_day, payment_due_day, reminder_time,
                       cycle_statement_done, cycle_due_paid, created_at, updated_at
                from credit_cards
                where user_id = :userId
                order by credit_card_id desc
                """;
        return readJdbc.query(sql, new MapSqlParameterSource("userId", userId), this::mapCard);
    }

    public Optional<CreditCardRow> findByIdAndUserId(long creditCardId, int userId) {
        var sql = """
                select credit_card_id, user_id, bank_name, card_label, last_four, credit_limit, outstanding_balance,
                       cardholder_name, statement_day, payment_due_day, reminder_time,
                       cycle_statement_done, cycle_due_paid, created_at, updated_at
                from credit_cards
                where credit_card_id = :id and user_id = :userId
                limit 1
                """;
        var list = readJdbc.query(sql,
                new MapSqlParameterSource("id", creditCardId).addValue("userId", userId),
                this::mapCard);
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    public long insert(CreditCardRow row) {
        var sql = """
                insert into credit_cards (user_id, bank_name, card_label, last_four, credit_limit, outstanding_balance,
                    cardholder_name, statement_day, payment_due_day, reminder_time,
                    cycle_statement_done, cycle_due_paid, created_at, updated_at)
                values (:user_id, :bank_name, :card_label, :last_four, :credit_limit, :outstanding_balance,
                    :cardholder_name, :statement_day, :payment_due_day, :reminder_time,
                    :cycle_statement_done, :cycle_due_paid, :created_at, :updated_at)
                """;
        var now = LocalDateTime.now();
        var params = new MapSqlParameterSource()
                .addValue("user_id", row.userId())
                .addValue("bank_name", row.bankName())
                .addValue("card_label", row.cardLabel())
                .addValue("last_four", row.lastFour())
                .addValue("credit_limit", row.creditLimit())
                .addValue("outstanding_balance", row.outstandingBalance())
                .addValue("cardholder_name", row.cardholderName())
                .addValue("statement_day", row.statementDay())
                .addValue("payment_due_day", row.paymentDueDay())
                .addValue("reminder_time", row.reminderTime())
                .addValue("cycle_statement_done", row.cycleStatementDone())
                .addValue("cycle_due_paid", row.cycleDuePaid())
                .addValue("created_at", Objects.requireNonNullElse(row.createdAt(), now))
                .addValue("updated_at", Objects.requireNonNullElse(row.updatedAt(), now));
        var keyHolder = new GeneratedKeyHolder();
        writeJdbc.update(sql, params, keyHolder, new String[]{"credit_card_id"});
        Number key = keyHolder.getKey();
        if (key == null) {
            throw new IllegalStateException("insert credit_cards returned no key");
        }
        return key.longValue();
    }

    public int update(CreditCardRow row) {
        var sql = """
                update credit_cards set
                    bank_name = :bank_name,
                    card_label = :card_label,
                    last_four = :last_four,
                    credit_limit = :credit_limit,
                    outstanding_balance = :outstanding_balance,
                    cardholder_name = :cardholder_name,
                    statement_day = :statement_day,
                    payment_due_day = :payment_due_day,
                    reminder_time = :reminder_time,
                    cycle_statement_done = :cycle_statement_done,
                    cycle_due_paid = :cycle_due_paid,
                    updated_at = :updated_at
                where credit_card_id = :credit_card_id and user_id = :user_id
                """;
        var params = new MapSqlParameterSource()
                .addValue("credit_card_id", row.creditCardId())
                .addValue("user_id", row.userId())
                .addValue("bank_name", row.bankName())
                .addValue("card_label", row.cardLabel())
                .addValue("last_four", row.lastFour())
                .addValue("credit_limit", row.creditLimit())
                .addValue("outstanding_balance", row.outstandingBalance())
                .addValue("cardholder_name", row.cardholderName())
                .addValue("statement_day", row.statementDay())
                .addValue("payment_due_day", row.paymentDueDay())
                .addValue("reminder_time", row.reminderTime())
                .addValue("cycle_statement_done", row.cycleStatementDone())
                .addValue("cycle_due_paid", row.cycleDuePaid())
                .addValue("updated_at", LocalDateTime.now());
        return writeJdbc.update(sql, params);
    }

    public int updateCycleFlags(long creditCardId, int userId, Boolean statementDone, Boolean duePaid) {
        if (statementDone == null && duePaid == null) {
            return 0;
        }
        if (statementDone != null && duePaid != null) {
            var sql = """
                    update credit_cards set cycle_statement_done = :sd, cycle_due_paid = :dp, updated_at = :ua
                    where credit_card_id = :id and user_id = :uid
                    """;
            return writeJdbc.update(sql, new MapSqlParameterSource()
                    .addValue("sd", statementDone)
                    .addValue("dp", duePaid)
                    .addValue("ua", LocalDateTime.now())
                    .addValue("id", creditCardId)
                    .addValue("uid", userId));
        }
        if (statementDone != null) {
            return writeJdbc.update("""
                            update credit_cards set cycle_statement_done = :sd, updated_at = :ua
                            where credit_card_id = :id and user_id = :uid
                            """,
                    new MapSqlParameterSource("sd", statementDone)
                            .addValue("ua", LocalDateTime.now())
                            .addValue("id", creditCardId)
                            .addValue("uid", userId));
        }
        return writeJdbc.update("""
                        update credit_cards set cycle_due_paid = :dp, updated_at = :ua
                        where credit_card_id = :id and user_id = :uid
                        """,
                new MapSqlParameterSource("dp", duePaid)
                        .addValue("ua", LocalDateTime.now())
                        .addValue("id", creditCardId)
                        .addValue("uid", userId));
    }

    public int delete(long creditCardId, int userId) {
        var sql = "delete from credit_cards where credit_card_id = :id and user_id = :uid";
        return writeJdbc.update(sql, new MapSqlParameterSource("id", creditCardId).addValue("uid", userId));
    }

    public long countPayments(long creditCardId, int userId) {
        var sql = """
                select count(*) from credit_card_payments p
                where p.credit_card_id = :cid and p.user_id = :uid
                """;
        Long n = readJdbc.queryForObject(sql,
                new MapSqlParameterSource("cid", creditCardId).addValue("uid", userId),
                Long.class);
        return n != null ? n : 0L;
    }

    public List<CreditCardPaymentRow> findPaymentsPage(long creditCardId, int userId, int offset, int limit) {
        var sql = """
                select p.payment_id, p.paid_at, p.amount, p.note, p.created_at
                from credit_card_payments p
                where p.credit_card_id = :cid and p.user_id = :uid
                order by p.paid_at desc, p.payment_id desc
                limit :limit offset :offset
                """;
        return readJdbc.query(sql,
                new MapSqlParameterSource("cid", creditCardId)
                        .addValue("uid", userId)
                        .addValue("limit", limit)
                        .addValue("offset", offset),
                this::mapPayment);
    }

    public long insertPayment(long creditCardId, int userId, LocalDate paidAt, BigDecimal amount, String note) {
        var sql = """
                insert into credit_card_payments (credit_card_id, user_id, paid_at, amount, note, created_at)
                values (:cid, :uid, :paid_at, :amount, :note, :ca)
                """;
        var params = new MapSqlParameterSource()
                .addValue("cid", creditCardId)
                .addValue("uid", userId)
                .addValue("paid_at", paidAt)
                .addValue("amount", amount)
                .addValue("note", note)
                .addValue("ca", LocalDateTime.now());
        var keyHolder = new GeneratedKeyHolder();
        writeJdbc.update(sql, params, keyHolder, new String[]{"payment_id"});
        Number key = keyHolder.getKey();
        if (key == null) {
            throw new IllegalStateException("insert payment returned no key");
        }
        return key.longValue();
    }

    public int deletePayment(long paymentId, long creditCardId, int userId) {
        var sql = """
                delete from credit_card_payments
                where payment_id = :pid and credit_card_id = :cid and user_id = :uid
                """;
        return writeJdbc.update(sql, new MapSqlParameterSource("pid", paymentId)
                .addValue("cid", creditCardId)
                .addValue("uid", userId));
    }

    public Optional<CreditCardPaymentRow> findPayment(long paymentId, long creditCardId, int userId) {
        var sql = """
                select payment_id, paid_at, amount, note, created_at
                from credit_card_payments
                where payment_id = :pid and credit_card_id = :cid and user_id = :uid
                limit 1
                """;
        var list = readJdbc.query(sql,
                new MapSqlParameterSource("pid", paymentId)
                        .addValue("cid", creditCardId)
                        .addValue("uid", userId),
                this::mapPayment);
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    private CreditCardRow mapCard(ResultSet rs, int rowNum) throws SQLException {
        var ct = rs.getTimestamp("created_at");
        var ut = rs.getTimestamp("updated_at");
        var rt = rs.getTime("reminder_time");
        LocalTime lt = rt != null ? rt.toLocalTime() : LocalTime.MIDNIGHT;
        return new CreditCardRow(
                rs.getLong("credit_card_id"),
                rs.getInt("user_id"),
                rs.getString("bank_name"),
                rs.getString("card_label"),
                rs.getString("last_four"),
                rs.getBigDecimal("credit_limit"),
                rs.getBigDecimal("outstanding_balance"),
                rs.getString("cardholder_name"),
                rs.getInt("statement_day"),
                rs.getInt("payment_due_day"),
                lt,
                rs.getBoolean("cycle_statement_done"),
                rs.getBoolean("cycle_due_paid"),
                ct != null ? ct.toLocalDateTime() : null,
                ut != null ? ut.toLocalDateTime() : null
        );
    }

    private CreditCardPaymentRow mapPayment(ResultSet rs, int rowNum) throws SQLException {
        var paid = rs.getDate("paid_at");
        var ca = rs.getTimestamp("created_at");
        return new CreditCardPaymentRow(
                rs.getLong("payment_id"),
                paid != null ? paid.toLocalDate() : null,
                rs.getBigDecimal("amount"),
                rs.getString("note"),
                ca != null ? ca.toLocalDateTime() : null
        );
    }

    public record CreditCardSummaryAgg(BigDecimal totalOutstanding, long count) {
    }

    public record CreditCardPaymentRow(
            long paymentId,
            LocalDate paidAt,
            BigDecimal amount,
            String note,
            LocalDateTime createdAt
    ) {
    }
}
