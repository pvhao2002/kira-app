package com.kira.farm.shared.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Whole-VND money helpers. Percentages go through BigDecimal with an explicit rounding mode, never floating point. */
public final class Money {
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private Money() {
    }

    /** {@code percent}% of {@code amount}, rounded half-up to whole VND. */
    public static long percentOf(long amount, long percent) {
        return BigDecimal.valueOf(amount).multiply(BigDecimal.valueOf(percent))
            .divide(HUNDRED, 0, RoundingMode.HALF_UP).longValueExact();
    }
}
