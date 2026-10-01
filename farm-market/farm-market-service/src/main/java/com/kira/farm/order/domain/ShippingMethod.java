package com.kira.farm.order.domain;

/** The single place that owns shipping fees and the free-shipping threshold. */
public enum ShippingMethod {
    STANDARD(25_000L), FAST(45_000L), PICKUP(0L);

    /** Standard shipping is free from this goods subtotal (VND). */
    public static final long FREE_SHIPPING_THRESHOLD = 200_000L;

    private final long baseFee;

    ShippingMethod(long baseFee) {
        this.baseFee = baseFee;
    }

    /** freeFast: the customer's tier includes free 2-hour delivery. */
    public long fee(long subtotal, boolean freeFast) {
        return switch (this) {
            case PICKUP -> 0L;
            case STANDARD -> subtotal >= FREE_SHIPPING_THRESHOLD ? 0L : baseFee;
            case FAST -> freeFast ? 0L : baseFee;
        };
    }
}
