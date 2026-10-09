package com.kira.bank.investment.application;

import com.kira.bank.investment.application.InvestmentReportDtos.GoalRequest;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

class InvestmentGoalRequestValidationTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    private int violations(String currency, String period, String amount) {
        return validator.validate(new GoalRequest(currency, period, amount == null ? null : new BigDecimal(amount))).size();
    }

    @Test
    void acceptsWellFormedGoals() {
        assertEquals(0, violations("VND", "MONTH", "1000000"));
        assertEquals(0, violations("usd", "YEAR", "0.5"));
    }

    @Test
    void rejectsBadCurrencyPeriodAndAmounts() {
        assertTrue(violations("VN", "MONTH", "1") > 0);
        assertTrue(violations("VND1", "MONTH", "1") > 0);
        assertTrue(violations("VND", "WEEK", "1") > 0);
        assertTrue(violations("VND", null, "1") > 0);
        assertTrue(violations("VND", "MONTH", "0") > 0);
        assertTrue(violations("VND", "MONTH", "-5") > 0);
        assertTrue(violations("VND", "MONTH", null) > 0);
        assertTrue(violations("VND", "MONTH", "1234567890123456.1") > 0); // too many integer digits for DECIMAL(19,4)
        assertTrue(violations("VND", "MONTH", "1.12345") > 0);              // more than 4 decimals
    }
}
