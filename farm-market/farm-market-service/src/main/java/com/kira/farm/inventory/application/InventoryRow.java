package com.kira.farm.inventory.application;

/** Admin inventory list row. Top-level (not nested) so JPQL constructor expressions resolve it reliably. */
public record InventoryRow(Long productId, String sku, String name, String unit, Long branchId, int onHand,
                           int reserved) {
    public static final int LOW_STOCK_LIMIT = 10;

    public int available() {
        return onHand - reserved;
    }

    /** OUT (hết hàng) when nothing is available, LOW (sắp hết) below the limit, otherwise OK. */
    public String level() {
        int a = available();
        return a <= 0 ? "OUT" : a < LOW_STOCK_LIMIT ? "LOW" : "OK";
    }
}
