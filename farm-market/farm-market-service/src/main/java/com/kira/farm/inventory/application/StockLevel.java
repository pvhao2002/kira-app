package com.kira.farm.inventory.application;

import com.kira.farm.shared.web.ApiException;

import java.util.Locale;

/** Stock health of a row by available units: OUT (hết hàng), LOW (sắp hết) below {@link #LOW_STOCK_LIMIT}, else OK. */
public enum StockLevel {
    OUT(Integer.MIN_VALUE, 0), LOW(1, StockLevel.LOW_STOCK_LIMIT - 1), OK(StockLevel.LOW_STOCK_LIMIT, Integer.MAX_VALUE);

    public static final int LOW_STOCK_LIMIT = 10;

    private final int minAvailable;
    private final int maxAvailable;

    StockLevel(int minAvailable, int maxAvailable) {
        this.minAvailable = minAvailable;
        this.maxAvailable = maxAvailable;
    }

    /** Inclusive range of available units that falls in this level (for BETWEEN filters). */
    public int minAvailable() {
        return minAvailable;
    }

    public int maxAvailable() {
        return maxAvailable;
    }

    public static StockLevel of(int available) {
        return available <= OUT.maxAvailable ? OUT : available <= LOW.maxAvailable ? LOW : OK;
    }

    /** Parses the {@code level} query parameter (case-insensitive); 400 INVALID_PARAMETER when unknown. */
    public static StockLevel parse(String level) {
        try {
            return valueOf(level.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("INVALID_PARAMETER", "Mức tồn không hợp lệ");
        }
    }
}
