package com.kira.farm.order;

import com.kira.farm.order.domain.OrderStatus;
import com.kira.farm.order.domain.ShippingMethod;
import org.junit.jupiter.api.Test;

import static com.kira.farm.order.domain.OrderStatus.*;
import static org.junit.jupiter.api.Assertions.*;

class OrderRulesTest {
    @Test
    void happyPathAndCancelAreAllowed() {
        assertTrue(PENDING.canMoveTo(CONFIRMED));
        assertTrue(CONFIRMED.canMoveTo(PREPARING));
        assertTrue(PREPARING.canMoveTo(SHIPPING));
        assertTrue(SHIPPING.canMoveTo(DELIVERED));
        for (OrderStatus s : new OrderStatus[]{PENDING, CONFIRMED, PREPARING, SHIPPING}) assertTrue(s.canMoveTo(CANCELLED));
    }

    @Test
    void skippingBackwardsAndFinalStatesAreRejected() {
        assertFalse(PENDING.canMoveTo(PREPARING));
        assertFalse(PENDING.canMoveTo(DELIVERED));
        assertFalse(CONFIRMED.canMoveTo(PENDING));
        assertFalse(SHIPPING.canMoveTo(PREPARING));
        for (OrderStatus to : OrderStatus.values()) {
            assertFalse(DELIVERED.canMoveTo(to));
            assertFalse(CANCELLED.canMoveTo(to));
        }
        assertTrue(DELIVERED.isFinal());
        assertTrue(CANCELLED.isFinal());
        assertFalse(SHIPPING.isFinal());
    }

    @Test
    void shippingFeeAndFreeShippingThreshold() {
        assertEquals(25_000, ShippingMethod.STANDARD.fee(199_999, false));
        assertEquals(0, ShippingMethod.STANDARD.fee(ShippingMethod.FREE_SHIPPING_THRESHOLD, false));
        assertEquals(0, ShippingMethod.STANDARD.fee(500_000, false));
        assertEquals(45_000, ShippingMethod.FAST.fee(1_000_000, false));
        assertEquals(0, ShippingMethod.FAST.fee(10_000, true));
        assertEquals(0, ShippingMethod.PICKUP.fee(1, false));
    }
}
