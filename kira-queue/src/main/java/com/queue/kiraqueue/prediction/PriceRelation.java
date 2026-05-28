package com.queue.kiraqueue.prediction;

import java.math.BigDecimal;

public enum PriceRelation {
    LT,
    GT,
    EQ;

    public static PriceRelation fromPrices(BigDecimal priceA, BigDecimal priceB) {
        if (priceA == null || priceB == null) {
            throw new IllegalArgumentException("prices are required");
        }
        int cmp = priceA.compareTo(priceB);
        if (cmp < 0) {
            return LT;
        }
        if (cmp > 0) {
            return GT;
        }
        return EQ;
    }

    public String sqlExpression(String priceAColumn, String priceBColumn) {
        return switch (this) {
            case LT -> priceAColumn + " < " + priceBColumn;
            case GT -> priceAColumn + " > " + priceBColumn;
            case EQ -> priceAColumn + " = " + priceBColumn;
        };
    }
}
