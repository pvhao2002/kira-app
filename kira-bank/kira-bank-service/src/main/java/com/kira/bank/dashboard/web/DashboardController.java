package com.kira.bank.dashboard.web;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.*;

@RestController
@RequestMapping("/api/v1/dashboards")
@RequiredArgsConstructor
public class DashboardController {
    private final JdbcTemplate jdbc;

    @GetMapping("/summary")
    Object summary(@AuthenticationPrincipal Long user) {
        return Map.of("creditCard", Map.of("totalSpending", sum("select coalesce(sum(amount),0) from card_transactions where user_id=? and deleted_at is null and status='POSTED'", user), "statementDebt", sum("select coalesce(sum(remaining_amount),0) from statements where user_id=? and deleted_at is null and status not in ('PAID','CANCELLED')", user), "cashbackWaiting", sum("select coalesce(sum(expected_cashback-actual_cashback),0) from cashback_records where user_id=? and deleted_at is null and status in ('WAITING','ELIGIBLE')", user), "cashbackReceived", sum("select coalesce(sum(actual_cashback),0) from cashback_records where user_id=? and deleted_at is null and status in ('RECEIVED','PARTIALLY_RECEIVED')", user), "discountProfit", sum("select coalesce(sum(actual_profit),0) from discount_invoices where user_id=? and deleted_at is null", user)), "investment", Map.of("currentBalance", sum("select coalesce(sum(current_balance),0) from investment_accounts where user_id=? and deleted_at is null", user), "availableCapital", sum("select coalesce(sum(available_capital),0) from investment_accounts where user_id=? and deleted_at is null", user), "lockedCapital", sum("select coalesce(sum(locked_capital),0) from investment_accounts where user_id=? and deleted_at is null", user), "profit", sum("select coalesce(sum(accumulated_profit),0) from investment_accounts where user_id=? and deleted_at is null", user), "reward", sum("select coalesce(sum(accumulated_reward),0) from investment_accounts where user_id=? and deleted_at is null", user), "pendingWithdrawal", sum("select coalesce(sum(reserved_withdrawal),0) from investment_accounts where user_id=? and deleted_at is null", user)));
    }

    private BigDecimal sum(String sql, Long user) {
        return jdbc.queryForObject(sql, BigDecimal.class, user);
    }
}
