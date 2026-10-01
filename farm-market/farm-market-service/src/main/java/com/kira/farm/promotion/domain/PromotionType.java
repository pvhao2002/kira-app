package com.kira.farm.promotion.domain;

public enum PromotionType {
    /** value = percent off the goods subtotal (0-100). */
    PERCENT,
    /** value = fixed VND off the goods subtotal. */
    FIXED,
    /** Waives the shipping fee; value is ignored. */
    FREE_SHIP
}
