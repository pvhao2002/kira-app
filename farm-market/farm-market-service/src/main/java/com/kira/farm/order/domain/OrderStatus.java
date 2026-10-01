package com.kira.farm.order.domain;

/** PENDING -> CONFIRMED -> PREPARING -> SHIPPING -> DELIVERED; CANCELLED reachable from any non-final state. */
public enum OrderStatus {
    PENDING, CONFIRMED, PREPARING, SHIPPING, DELIVERED, CANCELLED;

    public boolean isFinal() {
        return this == DELIVERED || this == CANCELLED;
    }

    public boolean canMoveTo(OrderStatus next) {
        return switch (this) {
            case PENDING -> next == CONFIRMED || next == CANCELLED;
            case CONFIRMED -> next == PREPARING || next == CANCELLED;
            case PREPARING -> next == SHIPPING || next == CANCELLED;
            case SHIPPING -> next == DELIVERED || next == CANCELLED;
            case DELIVERED, CANCELLED -> false;
        };
    }
}
