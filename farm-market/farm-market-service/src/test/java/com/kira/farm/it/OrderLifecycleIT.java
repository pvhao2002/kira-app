package com.kira.farm.it;

import com.kira.farm.it.Api.Res;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class OrderLifecycleIT extends IntegrationTestBase {

    private Res status(String token, String code, String to, String tracking) {
        return api.post("/api/v1/admin/orders/" + code + "/status", token,
            Api.map("status", to, "trackingCode", tracking));
    }

    @Test
    void staffOfTheBranchWalksTheOrderToDeliveredAndPointsAreAwardedOnce() {
        long product = newProduct(Q7, 100_000, 10);
        Customer c = newCustomer();
        String code = checkout(c, product, 5).str("code"); // 500.000 VND
        String staff = staffToken("STAFF", Q7);

        assertEquals("CONFIRMED", status(staff, code, "CONFIRMED", null).json().path("order").path("status").asText());
        assertEquals("PREPARING", status(staff, code, "PREPARING", null).json().path("order").path("status").asText());
        Res noTracking = status(staff, code, "SHIPPING", null);
        assertEquals(422, noTracking.status());
        assertEquals("TRACKING_REQUIRED", noTracking.code());
        Res shipping = status(staff, code, "SHIPPING", "VN123456");
        assertEquals("VN123456", shipping.json().path("order").path("trackingCode").asText());
        assertEquals(5, reserved(product), "stock stays reserved while shipping");

        Res delivered = status(staff, code, "DELIVERED", null);
        assertEquals(200, delivered.status(), delivered.json().toString());
        assertEquals("DELIVERED", delivered.json().path("order").path("status").asText());
        assertEquals("PAID", delivered.json().path("order").path("paymentStatus").asText()); // COD

        // Stock committed: on_hand and reserved both dropped, one SALE movement.
        assertEquals(5, onHand(product));
        assertEquals(0, reserved(product));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM inventory_movements WHERE product_id=? AND type='SALE' AND delta=-5",
            Integer.class, product));
        // 500.000 / 10.000 = 50 points, exactly one ledger row.
        assertEquals(50, balance(c.id()));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM loyalty_ledger WHERE ref_id=? AND reason='PURCHASE'", Integer.class, code));
        // History is append-only and complete: PENDING + 4 transitions.
        assertEquals(5, jdbc.queryForObject("SELECT COUNT(*) FROM order_status_history h JOIN orders o ON o.id=h.order_id WHERE o.code=?",
            Integer.class, code));

        // Terminal: cannot be moved or cancelled again, and points stay at 50.
        assertEquals("ORDER_INVALID_TRANSITION", status(staff, code, "CANCELLED", null).code());
        assertEquals("ORDER_NOT_CANCELLABLE", api.post("/api/v1/orders/" + code + "/cancel", c.token(), null).code());
        assertEquals(50, balance(c.id()));

        // The customer sees the same state.
        assertEquals("DELIVERED", api.get("/api/v1/orders/" + code, c.token()).str("status"));
    }

    @Test
    void invalidTransitionsAreRejected() {
        long product = newProduct(Q7, 10_000, 5);
        Customer c = newCustomer();
        String code = checkout(c, product, 1).str("code");
        String staff = staffToken("STAFF", Q7);
        Res skip = status(staff, code, "SHIPPING", "T1");
        assertEquals(409, skip.status());
        assertEquals("ORDER_INVALID_TRANSITION", skip.code());
        assertEquals("PENDING", api.get("/api/v1/orders/" + code, c.token()).str("status"));
    }

    @Test
    void staffOfAnotherBranchIsForbidden() {
        long product = newProduct(Q7, 10_000, 5);
        Customer c = newCustomer();
        String code = checkout(c, product, 1).str("code");
        String otherStaff = staffToken("STAFF", Q3);
        Res r = status(otherStaff, code, "CONFIRMED", null);
        assertEquals(403, r.status());
        assertEquals("BRANCH_FORBIDDEN", r.code());
        assertEquals(403, api.get("/api/v1/admin/orders/" + code, otherStaff).status());
        assertEquals("PENDING", api.get("/api/v1/orders/" + code, c.token()).str("status"));
        // Their list never leaks the order either.
        Res list = api.get("/api/v1/admin/orders?size=100", otherStaff);
        assertEquals(200, list.status());
        for (var o : list.json().path("data")) assertNotEquals(code, o.path("code").asText());
        // Asking explicitly for a foreign branch is refused.
        assertEquals(403, api.get("/api/v1/admin/orders?branchId=" + Q7, otherStaff).status());
    }
}
