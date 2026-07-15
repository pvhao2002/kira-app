package com.db.kiragateway.credit;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public class CreditCardWorkspaceRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public CreditCardWorkspaceRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public WorkspaceMoneySummary workspaceSummary(int userId, LocalDate monthStart, LocalDate monthEnd) {
        var sql = """
                select
                    coalesce(sum(case when status = 'PENDING' then expected_cashback_amount else 0 end), 0) pending_cashback,
                    sum(case when status = 'PENDING' then 1 else 0 end) pending_count,
                    coalesce(sum(case when transaction_date >= :monthStart and transaction_date < :monthEnd
                        and status <> 'CANCELLED' then discount_amount else 0 end), 0) invested_cost,
                    coalesce(sum(case when cashback_received_at >= :monthStart and cashback_received_at < :monthEnd
                        and status = 'RECEIVED' then actual_cashback_amount - discount_amount else 0 end), 0) realized_net
                from credit_card_cashback_transactions
                where user_id = :userId
                """;
        return jdbc.queryForObject(sql, new MapSqlParameterSource("userId", userId)
                .addValue("monthStart", monthStart)
                .addValue("monthEnd", monthEnd), (rs, rn) -> new WorkspaceMoneySummary(
                money(rs, "pending_cashback"),
                rs.getLong("pending_count"),
                money(rs, "invested_cost"),
                money(rs, "realized_net")
        ));
    }

    public List<MccRow> findMccCategories(int userId, boolean activeOnly) {
        var sql = """
                select m.mcc_category_id, m.user_id, m.mcc_code, m.category_name, m.description, m.active,
                       m.created_at, m.updated_at,
                       count(case when r.active = 1 then 1 end) active_rule_count,
                       coalesce(max(case when r.active = 1 then r.cashback_rate end), 0) best_cashback_rate
                from credit_card_mcc_categories m
                left join credit_card_cashback_rules r on r.mcc_category_id = m.mcc_category_id and r.user_id = m.user_id
                where m.user_id = :userId
                """ + (activeOnly ? " and m.active = 1\n" : "") + """
                group by m.mcc_category_id, m.user_id, m.mcc_code, m.category_name, m.description, m.active,
                         m.created_at, m.updated_at
                order by m.active desc, m.mcc_code
                """;
        return jdbc.query(sql, new MapSqlParameterSource("userId", userId), this::mapMcc);
    }

    public Optional<MccRow> findMccCategory(int userId, long categoryId) {
        var sql = """
                select m.mcc_category_id, m.user_id, m.mcc_code, m.category_name, m.description, m.active,
                       m.created_at, m.updated_at,
                       count(case when r.active = 1 then 1 end) active_rule_count,
                       coalesce(max(case when r.active = 1 then r.cashback_rate end), 0) best_cashback_rate
                from credit_card_mcc_categories m
                left join credit_card_cashback_rules r on r.mcc_category_id = m.mcc_category_id and r.user_id = m.user_id
                where m.user_id = :userId and m.mcc_category_id = :categoryId
                group by m.mcc_category_id, m.user_id, m.mcc_code, m.category_name, m.description, m.active,
                         m.created_at, m.updated_at
                """;
        var rows = jdbc.query(sql, new MapSqlParameterSource("userId", userId)
                .addValue("categoryId", categoryId), this::mapMcc);
        return rows.stream().findFirst();
    }

    public long insertMccCategory(int userId, String code, String name, String description) {
        var sql = """
                insert into credit_card_mcc_categories
                    (user_id, mcc_code, category_name, description, active, created_at, updated_at)
                values (:userId, :code, :name, :description, 1, :now, :now)
                """;
        return insertAndKey(sql, new MapSqlParameterSource("userId", userId)
                .addValue("code", code)
                .addValue("name", name)
                .addValue("description", description)
                .addValue("now", LocalDateTime.now()), "mcc_category_id");
    }

    public int updateMccCategory(int userId, long categoryId, String code, String name, String description, boolean active) {
        return jdbc.update("""
                update credit_card_mcc_categories
                set mcc_code = :code, category_name = :name, description = :description,
                    active = :active, updated_at = :now
                where user_id = :userId and mcc_category_id = :categoryId
                """, new MapSqlParameterSource("userId", userId)
                .addValue("categoryId", categoryId)
                .addValue("code", code)
                .addValue("name", name)
                .addValue("description", description)
                .addValue("active", active)
                .addValue("now", LocalDateTime.now()));
    }

    public int deactivateMccCategory(int userId, long categoryId) {
        jdbc.update("""
                update credit_card_cashback_rules set active = 0, updated_at = :now
                where user_id = :userId and mcc_category_id = :categoryId
                """, new MapSqlParameterSource("userId", userId)
                .addValue("categoryId", categoryId)
                .addValue("now", LocalDateTime.now()));
        return jdbc.update("""
                update credit_card_mcc_categories set active = 0, updated_at = :now
                where user_id = :userId and mcc_category_id = :categoryId
                """, new MapSqlParameterSource("userId", userId)
                .addValue("categoryId", categoryId)
                .addValue("now", LocalDateTime.now()));
    }

    public List<RuleRow> findRulesByCategory(int userId, long categoryId) {
        return jdbc.query(ruleSelect() + """
                where r.user_id = :userId and r.mcc_category_id = :categoryId
                order by r.active desc, r.cashback_rate desc, r.effective_from desc
                """, new MapSqlParameterSource("userId", userId).addValue("categoryId", categoryId), this::mapRule);
    }

    public List<RuleRow> findRulesByCard(int userId, long cardId) {
        return jdbc.query(ruleSelect() + """
                where r.user_id = :userId and r.credit_card_id = :cardId
                order by r.active desc, m.mcc_code, r.effective_from desc
                """, new MapSqlParameterSource("userId", userId).addValue("cardId", cardId), this::mapRule);
    }

    public Optional<RuleRow> findRule(int userId, long ruleId) {
        var rows = jdbc.query(ruleSelect() + """
                where r.user_id = :userId and r.cashback_rule_id = :ruleId
                limit 1
                """, new MapSqlParameterSource("userId", userId).addValue("ruleId", ruleId), this::mapRule);
        return rows.stream().findFirst();
    }

    public Optional<RuleRow> findActiveRule(int userId, long cardId, long categoryId, LocalDate transactionDate) {
        var rows = jdbc.query(ruleSelect() + """
                where r.user_id = :userId and r.credit_card_id = :cardId and r.mcc_category_id = :categoryId
                  and r.active = 1 and r.effective_from <= :txDate
                  and (r.effective_to is null or r.effective_to >= :txDate)
                order by r.effective_from desc
                limit 1
                """, new MapSqlParameterSource("userId", userId)
                .addValue("cardId", cardId)
                .addValue("categoryId", categoryId)
                .addValue("txDate", transactionDate), this::mapRule);
        return rows.stream().findFirst();
    }

    public boolean hasOverlappingRule(int userId, long cardId, long categoryId,
                                      LocalDate from, LocalDate to, Long excludedRuleId) {
        var sql = """
                select count(*) from credit_card_cashback_rules
                where user_id = :userId and credit_card_id = :cardId and mcc_category_id = :categoryId
                  and active = 1
                  and effective_from <= coalesce(:effectiveTo, '9999-12-31')
                  and coalesce(effective_to, '9999-12-31') >= :effectiveFrom
                """ + (excludedRuleId != null ? " and cashback_rule_id <> :excludedRuleId" : "");
        var params = new MapSqlParameterSource("userId", userId)
                .addValue("cardId", cardId)
                .addValue("categoryId", categoryId)
                .addValue("effectiveFrom", from)
                .addValue("effectiveTo", to);
        if (excludedRuleId != null) {
            params.addValue("excludedRuleId", excludedRuleId);
        }
        Long count = jdbc.queryForObject(sql, params, Long.class);
        return count != null && count > 0;
    }

    public long insertRule(int userId, long cardId, long categoryId, BigDecimal rate, BigDecimal cap,
                           LocalDate from, LocalDate to, String note) {
        var sql = """
                insert into credit_card_cashback_rules
                    (user_id, credit_card_id, mcc_category_id, cashback_rate, monthly_cap_amount,
                     effective_from, effective_to, active, note, created_at, updated_at)
                values (:userId, :cardId, :categoryId, :rate, :cap, :effectiveFrom, :effectiveTo,
                        1, :note, :now, :now)
                """;
        return insertAndKey(sql, new MapSqlParameterSource("userId", userId)
                .addValue("cardId", cardId)
                .addValue("categoryId", categoryId)
                .addValue("rate", rate)
                .addValue("cap", cap)
                .addValue("effectiveFrom", from)
                .addValue("effectiveTo", to)
                .addValue("note", note)
                .addValue("now", LocalDateTime.now()), "cashback_rule_id");
    }

    public int updateRule(int userId, long ruleId, BigDecimal rate, BigDecimal cap, LocalDate from,
                          LocalDate to, boolean active, String note) {
        return jdbc.update("""
                update credit_card_cashback_rules
                set cashback_rate = :rate, monthly_cap_amount = :cap, effective_from = :effectiveFrom,
                    effective_to = :effectiveTo, active = :active, note = :note, updated_at = :now
                where user_id = :userId and cashback_rule_id = :ruleId
                """, new MapSqlParameterSource("userId", userId)
                .addValue("ruleId", ruleId)
                .addValue("rate", rate)
                .addValue("cap", cap)
                .addValue("effectiveFrom", from)
                .addValue("effectiveTo", to)
                .addValue("active", active)
                .addValue("note", note)
                .addValue("now", LocalDateTime.now()));
    }

    public int deactivateRule(int userId, long ruleId) {
        return jdbc.update("""
                update credit_card_cashback_rules set active = 0, updated_at = :now
                where user_id = :userId and cashback_rule_id = :ruleId
                """, new MapSqlParameterSource("userId", userId)
                .addValue("ruleId", ruleId)
                .addValue("now", LocalDateTime.now()));
    }

    public BigDecimal monthExpectedCashback(int userId, long cardId, long categoryId,
                                            LocalDate monthStart, LocalDate monthEnd, Long excludedTransactionId) {
        var sql = """
                select coalesce(sum(expected_cashback_amount), 0)
                from credit_card_cashback_transactions
                where user_id = :userId and credit_card_id = :cardId and mcc_category_id = :categoryId
                  and transaction_date >= :monthStart and transaction_date < :monthEnd
                  and status <> 'CANCELLED'
                """ + (excludedTransactionId != null ? " and transaction_id <> :excludedId" : "");
        var params = new MapSqlParameterSource("userId", userId)
                .addValue("cardId", cardId)
                .addValue("categoryId", categoryId)
                .addValue("monthStart", monthStart)
                .addValue("monthEnd", monthEnd);
        if (excludedTransactionId != null) {
            params.addValue("excludedId", excludedTransactionId);
        }
        BigDecimal result = jdbc.queryForObject(sql, params, BigDecimal.class);
        return result != null ? result : BigDecimal.ZERO;
    }

    public long insertCashbackTransaction(CashbackRow row) {
        var sql = """
                insert into credit_card_cashback_transactions
                    (user_id, credit_card_id, mcc_category_id, transaction_date, customer_name, bill_reference,
                     description, spend_amount, discount_rate, discount_amount, cashback_rate_snapshot,
                     monthly_cap_snapshot, expected_cashback_amount, actual_cashback_amount, cashback_due_date,
                     cashback_received_at, status, note, created_at, updated_at)
                values (:userId, :cardId, :categoryId, :transactionDate, :customerName, :billReference,
                        :description, :spendAmount, :discountRate, :discountAmount, :cashbackRate,
                        :monthlyCap, :expectedCashback, null, :cashbackDueDate, null, 'PENDING', :note, :now, :now)
                """;
        return insertAndKey(sql, cashbackParams(row), "transaction_id");
    }

    public int updateCashbackTransaction(CashbackRow row) {
        return jdbc.update("""
                update credit_card_cashback_transactions
                set credit_card_id = :cardId, mcc_category_id = :categoryId, transaction_date = :transactionDate,
                    customer_name = :customerName, bill_reference = :billReference, description = :description,
                    spend_amount = :spendAmount, discount_rate = :discountRate, discount_amount = :discountAmount,
                    cashback_rate_snapshot = :cashbackRate, monthly_cap_snapshot = :monthlyCap,
                    expected_cashback_amount = :expectedCashback, cashback_due_date = :cashbackDueDate,
                    note = :note, updated_at = :now
                where user_id = :userId and transaction_id = :transactionId and status = 'PENDING'
                """, cashbackParams(row).addValue("transactionId", row.transactionId()));
    }

    public Optional<CashbackRow> findCashbackTransaction(int userId, long transactionId) {
        var rows = jdbc.query(cashbackSelect() + """
                where t.user_id = :userId and t.transaction_id = :transactionId
                limit 1
                """, new MapSqlParameterSource("userId", userId)
                .addValue("transactionId", transactionId), this::mapCashback);
        return rows.stream().findFirst();
    }

    public List<CashbackRow> findCashbackTransactions(int userId, Long cardId, Long categoryId, String status,
                                                       LocalDate from, LocalDate to, int offset, int limit) {
        var filter = cashbackFilter(cardId, categoryId, status, from, to);
        return jdbc.query(cashbackSelect() + filter.sql() + """
                order by t.transaction_date desc, t.transaction_id desc
                limit :limit offset :offset
                """, filter.params(userId).addValue("limit", limit).addValue("offset", offset), this::mapCashback);
    }

    public long countCashbackTransactions(int userId, Long cardId, Long categoryId, String status,
                                           LocalDate from, LocalDate to) {
        var filter = cashbackFilter(cardId, categoryId, status, from, to);
        Long count = jdbc.queryForObject("select count(*) from credit_card_cashback_transactions t " + filter.sql(),
                filter.params(userId), Long.class);
        return count != null ? count : 0;
    }

    public int receiveCashback(int userId, long transactionId, BigDecimal amount, LocalDate receivedAt) {
        return jdbc.update("""
                update credit_card_cashback_transactions
                set actual_cashback_amount = :amount, cashback_received_at = :receivedAt,
                    status = 'RECEIVED', updated_at = :now
                where user_id = :userId and transaction_id = :transactionId and status = 'PENDING'
                """, new MapSqlParameterSource("userId", userId)
                .addValue("transactionId", transactionId)
                .addValue("amount", amount)
                .addValue("receivedAt", receivedAt)
                .addValue("now", LocalDateTime.now()));
    }

    public int cancelCashback(int userId, long transactionId) {
        return jdbc.update("""
                update credit_card_cashback_transactions
                set status = 'CANCELLED', updated_at = :now
                where user_id = :userId and transaction_id = :transactionId and status = 'PENDING'
                """, new MapSqlParameterSource("userId", userId)
                .addValue("transactionId", transactionId)
                .addValue("now", LocalDateTime.now()));
    }

    public List<StatementRow> findStatementCycles(int userId, Long cardId, LocalDate cycleMonth) {
        var sql = new StringBuilder(statementSelect()).append(" where s.user_id = :userId");
        var params = new MapSqlParameterSource("userId", userId);
        if (cardId != null) {
            sql.append(" and s.credit_card_id = :cardId");
            params.addValue("cardId", cardId);
        }
        if (cycleMonth != null) {
            sql.append(" and s.cycle_month = :cycleMonth");
            params.addValue("cycleMonth", cycleMonth);
        }
        sql.append(" order by s.cycle_month desc, s.statement_cycle_id desc");
        return jdbc.query(sql.toString(), params, this::mapStatement);
    }

    public List<StatementRow> findDueStatements(int userId, LocalDate maxDueDate, int limit) {
        return jdbc.query(statementSelect() + """
                where s.user_id = :userId and s.statement_issued_at is not null
                  and s.due_date <= :maxDueDate
                  and coalesce(p.paid_amount, 0) < coalesce(s.statement_amount, 0)
                order by s.due_date
                limit :limit
                """, new MapSqlParameterSource("userId", userId)
                .addValue("maxDueDate", maxDueDate)
                .addValue("limit", limit), this::mapStatement);
    }

    public Optional<StatementRow> findStatementCycle(int userId, long cardId, long cycleId) {
        var rows = jdbc.query(statementSelect() + """
                where s.user_id = :userId and s.credit_card_id = :cardId and s.statement_cycle_id = :cycleId
                limit 1
                """, new MapSqlParameterSource("userId", userId)
                .addValue("cardId", cardId)
                .addValue("cycleId", cycleId), this::mapStatement);
        return rows.stream().findFirst();
    }

    public long insertStatementCycle(StatementRow row) {
        var sql = """
                insert into credit_card_statement_cycles
                    (user_id, credit_card_id, cycle_month, statement_date, due_date, statement_amount,
                     statement_issued_at, note, created_at, updated_at)
                values (:userId, :cardId, :cycleMonth, :statementDate, :dueDate, :statementAmount,
                        :issuedAt, :note, :now, :now)
                """;
        return insertAndKey(sql, statementParams(row), "statement_cycle_id");
    }

    public int updateStatementCycle(StatementRow row) {
        return jdbc.update("""
                update credit_card_statement_cycles
                set statement_date = :statementDate, due_date = :dueDate, statement_amount = :statementAmount,
                    statement_issued_at = :issuedAt, note = :note, updated_at = :now
                where user_id = :userId and credit_card_id = :cardId and statement_cycle_id = :cycleId
                """, statementParams(row).addValue("cycleId", row.statementCycleId()));
    }

    private Filter cashbackFilter(Long cardId, Long categoryId, String status, LocalDate from, LocalDate to) {
        var sql = new StringBuilder(" where t.user_id = :userId");
        var values = new MapSqlParameterSource();
        if (cardId != null) {
            sql.append(" and t.credit_card_id = :cardId");
            values.addValue("cardId", cardId);
        }
        if (categoryId != null) {
            sql.append(" and t.mcc_category_id = :categoryId");
            values.addValue("categoryId", categoryId);
        }
        if (status != null && !status.isBlank()) {
            sql.append(" and t.status = :status");
            values.addValue("status", status);
        }
        if (from != null) {
            sql.append(" and t.transaction_date >= :fromDate");
            values.addValue("fromDate", from);
        }
        if (to != null) {
            sql.append(" and t.transaction_date <= :toDate");
            values.addValue("toDate", to);
        }
        return new Filter(sql.append(' ').toString(), values);
    }

    private MapSqlParameterSource cashbackParams(CashbackRow row) {
        return new MapSqlParameterSource("userId", row.userId())
                .addValue("cardId", row.creditCardId())
                .addValue("categoryId", row.mccCategoryId())
                .addValue("transactionDate", row.transactionDate())
                .addValue("customerName", row.customerName())
                .addValue("billReference", row.billReference())
                .addValue("description", row.description())
                .addValue("spendAmount", row.spendAmount())
                .addValue("discountRate", row.discountRate())
                .addValue("discountAmount", row.discountAmount())
                .addValue("cashbackRate", row.cashbackRate())
                .addValue("monthlyCap", row.monthlyCap())
                .addValue("expectedCashback", row.expectedCashback())
                .addValue("cashbackDueDate", row.cashbackDueDate())
                .addValue("note", row.note())
                .addValue("now", LocalDateTime.now());
    }

    private MapSqlParameterSource statementParams(StatementRow row) {
        return new MapSqlParameterSource("userId", row.userId())
                .addValue("cardId", row.creditCardId())
                .addValue("cycleMonth", row.cycleMonth())
                .addValue("statementDate", row.statementDate())
                .addValue("dueDate", row.dueDate())
                .addValue("statementAmount", row.statementAmount())
                .addValue("issuedAt", row.statementIssuedAt())
                .addValue("note", row.note())
                .addValue("now", LocalDateTime.now());
    }

    private long insertAndKey(String sql, MapSqlParameterSource params, String keyColumn) {
        var holder = new GeneratedKeyHolder();
        jdbc.update(sql, params, holder, new String[]{keyColumn});
        Number key = holder.getKey();
        if (key == null) {
            throw new IllegalStateException("Insert returned no generated key for " + keyColumn);
        }
        return key.longValue();
    }

    private String ruleSelect() {
        return """
                select r.cashback_rule_id, r.user_id, r.credit_card_id, r.mcc_category_id,
                       r.cashback_rate, r.monthly_cap_amount, r.effective_from, r.effective_to,
                       r.active, r.note, r.created_at, r.updated_at,
                       c.card_label, c.bank_name, c.last_four, m.mcc_code, m.category_name
                from credit_card_cashback_rules r
                join credit_cards c on c.credit_card_id = r.credit_card_id and c.user_id = r.user_id
                join credit_card_mcc_categories m on m.mcc_category_id = r.mcc_category_id and m.user_id = r.user_id
                """;
    }

    private String cashbackSelect() {
        return """
                select t.transaction_id, t.user_id, t.credit_card_id, t.mcc_category_id,
                       t.transaction_date, t.customer_name, t.bill_reference, t.description,
                       t.spend_amount, t.discount_rate, t.discount_amount, t.cashback_rate_snapshot,
                       t.monthly_cap_snapshot, t.expected_cashback_amount, t.actual_cashback_amount,
                       t.cashback_due_date, t.cashback_received_at, t.status, t.note, t.created_at, t.updated_at,
                       c.card_label, c.bank_name, c.last_four, m.mcc_code, m.category_name
                from credit_card_cashback_transactions t
                join credit_cards c on c.credit_card_id = t.credit_card_id and c.user_id = t.user_id
                left join credit_card_mcc_categories m on m.mcc_category_id = t.mcc_category_id and m.user_id = t.user_id
                """;
    }

    private String statementSelect() {
        return """
                select s.statement_cycle_id, s.user_id, s.credit_card_id, s.cycle_month, s.statement_date,
                       s.due_date, s.statement_amount, s.statement_issued_at, s.note, s.created_at, s.updated_at,
                       c.card_label, c.bank_name, c.last_four, coalesce(p.paid_amount, 0) paid_amount
                from credit_card_statement_cycles s
                join credit_cards c on c.credit_card_id = s.credit_card_id and c.user_id = s.user_id
                left join (
                    select statement_cycle_id, sum(amount) paid_amount
                    from credit_card_payments where statement_cycle_id is not null group by statement_cycle_id
                ) p on p.statement_cycle_id = s.statement_cycle_id
                """;
    }

    private MccRow mapMcc(ResultSet rs, int rowNum) throws SQLException {
        return new MccRow(rs.getLong("mcc_category_id"), rs.getInt("user_id"), rs.getString("mcc_code"),
                rs.getString("category_name"), rs.getString("description"), rs.getBoolean("active"),
                rs.getLong("active_rule_count"), money(rs, "best_cashback_rate"),
                timestamp(rs, "created_at"), timestamp(rs, "updated_at"));
    }

    private RuleRow mapRule(ResultSet rs, int rowNum) throws SQLException {
        return new RuleRow(rs.getLong("cashback_rule_id"), rs.getInt("user_id"), rs.getLong("credit_card_id"),
                rs.getLong("mcc_category_id"), rs.getString("card_label"), rs.getString("bank_name"),
                rs.getString("last_four"), rs.getString("mcc_code"), rs.getString("category_name"),
                money(rs, "cashback_rate"), rs.getBigDecimal("monthly_cap_amount"),
                date(rs, "effective_from"), date(rs, "effective_to"), rs.getBoolean("active"), rs.getString("note"),
                timestamp(rs, "created_at"), timestamp(rs, "updated_at"));
    }

    private CashbackRow mapCashback(ResultSet rs, int rowNum) throws SQLException {
        Long categoryId = (Long) rs.getObject("mcc_category_id");
        return new CashbackRow(rs.getLong("transaction_id"), rs.getInt("user_id"), rs.getLong("credit_card_id"),
                categoryId, rs.getString("card_label"), rs.getString("bank_name"),
                rs.getString("last_four"), rs.getString("mcc_code"), rs.getString("category_name"),
                date(rs, "transaction_date"), rs.getString("customer_name"), rs.getString("bill_reference"),
                rs.getString("description"), money(rs, "spend_amount"), money(rs, "discount_rate"),
                money(rs, "discount_amount"), money(rs, "cashback_rate_snapshot"),
                rs.getBigDecimal("monthly_cap_snapshot"), money(rs, "expected_cashback_amount"),
                rs.getBigDecimal("actual_cashback_amount"), date(rs, "cashback_due_date"),
                date(rs, "cashback_received_at"), rs.getString("status"), rs.getString("note"),
                timestamp(rs, "created_at"), timestamp(rs, "updated_at"));
    }

    private StatementRow mapStatement(ResultSet rs, int rowNum) throws SQLException {
        return new StatementRow(rs.getLong("statement_cycle_id"), rs.getInt("user_id"), rs.getLong("credit_card_id"),
                rs.getString("card_label"), rs.getString("bank_name"), rs.getString("last_four"),
                date(rs, "cycle_month"), date(rs, "statement_date"), date(rs, "due_date"),
                rs.getBigDecimal("statement_amount"), money(rs, "paid_amount"), timestamp(rs, "statement_issued_at"),
                rs.getString("note"), timestamp(rs, "created_at"), timestamp(rs, "updated_at"));
    }

    private static BigDecimal money(ResultSet rs, String name) throws SQLException {
        BigDecimal value = rs.getBigDecimal(name);
        return value != null ? value : BigDecimal.ZERO;
    }

    private static LocalDate date(ResultSet rs, String name) throws SQLException {
        var value = rs.getDate(name);
        return value != null ? value.toLocalDate() : null;
    }

    private static LocalDateTime timestamp(ResultSet rs, String name) throws SQLException {
        var value = rs.getTimestamp(name);
        return value != null ? value.toLocalDateTime() : null;
    }

    public record WorkspaceMoneySummary(BigDecimal pendingCashback, long pendingCount,
                                        BigDecimal investedCost, BigDecimal realizedNet) {
    }

    public record MccRow(long mccCategoryId, int userId, String mccCode, String categoryName,
                         String description, boolean active, long activeRuleCount, BigDecimal bestCashbackRate,
                         LocalDateTime createdAt, LocalDateTime updatedAt) {
    }

    public record RuleRow(long ruleId, int userId, long creditCardId, long categoryId, String cardLabel,
                          String bankName, String lastFour, String mccCode, String categoryName,
                          BigDecimal cashbackRate, BigDecimal monthlyCap, LocalDate effectiveFrom,
                          LocalDate effectiveTo, boolean active, String note,
                          LocalDateTime createdAt, LocalDateTime updatedAt) {
    }

    public record CashbackRow(long transactionId, int userId, long creditCardId, Long mccCategoryId,
                              String cardLabel, String bankName, String lastFour, String mccCode,
                              String mccCategoryName, LocalDate transactionDate, String customerName,
                              String billReference, String description, BigDecimal spendAmount,
                              BigDecimal discountRate, BigDecimal discountAmount, BigDecimal cashbackRate,
                              BigDecimal monthlyCap, BigDecimal expectedCashback, BigDecimal actualCashback,
                              LocalDate cashbackDueDate, LocalDate cashbackReceivedAt, String status, String note,
                              LocalDateTime createdAt, LocalDateTime updatedAt) {
    }

    public record StatementRow(long statementCycleId, int userId, long creditCardId, String cardLabel,
                               String bankName, String lastFour, LocalDate cycleMonth, LocalDate statementDate,
                               LocalDate dueDate, BigDecimal statementAmount, BigDecimal paidAmount,
                               LocalDateTime statementIssuedAt, String note,
                               LocalDateTime createdAt, LocalDateTime updatedAt) {
    }

    private record Filter(String sql, MapSqlParameterSource values) {
        MapSqlParameterSource params(int userId) {
            values.addValue("userId", userId);
            return values;
        }
    }
}
