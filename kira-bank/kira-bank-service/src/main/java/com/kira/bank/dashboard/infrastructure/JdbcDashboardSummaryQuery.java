package com.kira.bank.dashboard.infrastructure;

import com.kira.bank.dashboard.application.DashboardSummaryQuery;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.Map;

import static com.kira.bank.dashboard.application.DashboardSummaryDtos.CreditCardSummaryResponse;
import static com.kira.bank.dashboard.application.DashboardSummaryDtos.InvestmentSummaryResponse;

@Repository
@RequiredArgsConstructor
public class JdbcDashboardSummaryQuery implements DashboardSummaryQuery {
    private static final String CREDIT_CARD_SUMMARY_SQL = """
        select
            (
                select coalesce(sum(card_transaction.amount), 0)
                from card_transactions card_transaction
                where card_transaction.user_id = :userId
                  and card_transaction.deleted_at is null
                  and card_transaction.status = 'POSTED'
            ) as total_spending,
            (
                select coalesce(sum(card_statement.remaining_amount), 0)
                from statements card_statement
                where card_statement.user_id = :userId
                  and card_statement.deleted_at is null
                  and card_statement.status not in ('PAID', 'CANCELLED')
            ) as statement_debt,
            (
                select coalesce(sum(cashback_record.expected_cashback - cashback_record.actual_cashback), 0)
                from cashback_records cashback_record
                where cashback_record.user_id = :userId
                  and cashback_record.deleted_at is null
                  and cashback_record.status in ('WAITING', 'ELIGIBLE')
            ) as cashback_waiting,
            (
                select coalesce(sum(cashback_record.actual_cashback), 0)
                from cashback_records cashback_record
                where cashback_record.user_id = :userId
                  and cashback_record.deleted_at is null
                  and cashback_record.status in ('RECEIVED', 'PARTIALLY_RECEIVED')
            ) as cashback_received,
            (
                select coalesce(sum(discount_invoice.actual_profit), 0)
                from discount_invoices discount_invoice
                where discount_invoice.user_id = :userId
                  and discount_invoice.deleted_at is null
            ) as discount_profit
        """;

    private static final String INVESTMENT_SUMMARY_SQL = """
        select
            coalesce(sum(investment_account.current_balance), 0) as current_balance,
            coalesce(sum(investment_account.available_capital), 0) as available_capital,
            coalesce(sum(investment_account.locked_capital), 0) as locked_capital,
            coalesce(sum(investment_account.accumulated_profit), 0) as profit,
            coalesce(sum(investment_account.accumulated_reward), 0) as reward,
            coalesce(sum(investment_account.reserved_withdrawal), 0) as pending_withdrawal
        from investment_accounts investment_account
        where investment_account.user_id = :userId
          and investment_account.deleted_at is null
        """;

    private final NamedParameterJdbcTemplate jdbc;

    @Override
    public CreditCardSummaryResponse creditCardSummary(Long userId) {
        return jdbc.queryForObject(
            CREDIT_CARD_SUMMARY_SQL,
            parameters(userId),
            (result, rowNumber) -> new CreditCardSummaryResponse(
                result.getBigDecimal("total_spending"),
                result.getBigDecimal("statement_debt"),
                result.getBigDecimal("cashback_waiting"),
                result.getBigDecimal("cashback_received"),
                result.getBigDecimal("discount_profit")
            )
        );
    }

    @Override
    public InvestmentSummaryResponse investmentSummary(Long userId) {
        return jdbc.queryForObject(
            INVESTMENT_SUMMARY_SQL,
            parameters(userId),
            (result, rowNumber) -> new InvestmentSummaryResponse(
                result.getBigDecimal("current_balance"),
                result.getBigDecimal("available_capital"),
                result.getBigDecimal("locked_capital"),
                result.getBigDecimal("profit"),
                result.getBigDecimal("reward"),
                result.getBigDecimal("pending_withdrawal")
            )
        );
    }

    private Map<String, Long> parameters(Long userId) {
        return Map.of("userId", userId);
    }
}
