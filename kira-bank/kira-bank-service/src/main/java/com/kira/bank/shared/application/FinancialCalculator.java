package com.kira.bank.shared.application;

import com.kira.bank.shared.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Component
public class FinancialCalculator {
    public static final int SCALE = 4;

    public BigDecimal money(BigDecimal value) {
        return value.setScale(SCALE, RoundingMode.HALF_UP);
    }

    public BigDecimal cashback(BigDecimal eligible, BigDecimal rate, BigDecimal cap) {
        BigDecimal raw = money(eligible.multiply(rate));
        return cap == null ? raw : raw.min(cap);
    }

    public BigDecimal profit(BigDecimal cashback, BigDecimal discount, BigDecimal fee) {
        return money(cashback.subtract(discount).subtract(fee));
    }

    public void validateSettlement(BigDecimal total, BigDecimal capital, BigDecimal profit, BigDecimal reward, BigDecimal fee, BigDecimal tolerance) {
        BigDecimal expected = money(capital.add(profit).add(reward).subtract(fee));
        if (expected.subtract(total).abs().compareTo(tolerance) > 0)
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_SETTLEMENT_TOTAL", "Tổng nhận không khớp capital + profit + reward - fee");
    }
}

