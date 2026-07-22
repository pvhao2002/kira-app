package com.kira.bank.shared.application;

import com.kira.bank.shared.web.ApiException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.*;

class FinancialCalculatorTest {
    private final FinancialCalculator calculator = new FinancialCalculator();

    @Test
    void calculatesCashbackWithCapAndHalfUpRounding() {
        assertThat(calculator.cashback(new BigDecimal("100000000"), new BigDecimal("0.05"), new BigDecimal("4000000"))).isEqualByComparingTo("4000000.0000");
    }

    @Test
    void calculatesDiscountInvoiceProfitAfterAllCosts() {
        assertThat(calculator.profit(new BigDecimal("5000000"), new BigDecimal("2000000"), BigDecimal.ZERO)).isEqualByComparingTo("3000000.0000");
    }

    @Test
    void settlementKeepsCapitalProfitAndRewardSeparate() {
        assertThatCode(() -> calculator.validateSettlement(new BigDecimal("10550000"), new BigDecimal("10000000"), new BigDecimal("500000"), new BigDecimal("100000"), new BigDecimal("50000"), new BigDecimal("0.01"))).doesNotThrowAnyException();
        assertThatThrownBy(() -> calculator.validateSettlement(new BigDecimal("10600000"), new BigDecimal("10000000"), new BigDecimal("500000"), new BigDecimal("100000"), new BigDecimal("50000"), new BigDecimal("0.01"))).isInstanceOf(ApiException.class);
    }
}

