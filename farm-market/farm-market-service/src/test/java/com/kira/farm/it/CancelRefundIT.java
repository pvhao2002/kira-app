package com.kira.farm.it;

import com.kira.farm.it.Api.Res;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class CancelRefundIT extends IntegrationTestBase {

    private String newPromo(long branchId, int usageLimit) {
        String code = unique("PROMO").toUpperCase();
        jdbc.update("INSERT INTO promotions (code, type, value, min_order, starts_at, ends_at, usage_limit, active, all_branches, "
                + "created_at, updated_at) VALUES (?, 'FIXED', 10000, 0, UTC_TIMESTAMP(6) - INTERVAL 1 DAY, "
                + "UTC_TIMESTAMP(6) + INTERVAL 1 DAY, ?, 1, 1, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6))", code, usageLimit);
        return code;
    }

    private String newVoucher(long userId) {
        String code = unique("VC").toUpperCase();
        jdbc.update("INSERT INTO vouchers (user_id, code, title, discount_type, value, min_order, points_cost, status, expires_at, "
            + "created_at) VALUES (?,?,'Test','FIXED',20000,0,0,'AVAILABLE',UTC_TIMESTAMP(6) + INTERVAL 30 DAY,UTC_TIMESTAMP(6))", userId, code);
        return code;
    }

    private int promoUsed(String code) {
        return jdbc.queryForObject("SELECT used_count FROM promotions WHERE code=?", Integer.class, code);
    }

    private String voucherStatus(String code) {
        return jdbc.queryForObject("SELECT status FROM vouchers WHERE code=?", String.class, code);
    }

    @Test
    void cancelRestoresPointsVoucherPromoAndStockExactlyOnce() {
        long product = newProduct(Q7, 100_000, 10);
        Customer c = newCustomer();
        grantPoints(c.id(), 200);
        String promo = newPromo(Q7, 5);
        String voucher = newVoucher(c.id());

        var body = checkoutBody(c, product, 2); // 200.000
        body.put("usePoints", 50);               // -5.000
        body.put("promoCode", promo);            // -10.000
        body.put("voucherCode", voucher);        // -20.000
        Res order = checkout(c, body, unique("idem"));
        assertEquals(201, order.status(), order.json().toString());
        String code = order.str("code");
        assertEquals(200_000 - 10_000 - 20_000 - 5_000, order.num("total"));
        assertEquals(150, balance(c.id()));
        assertEquals("USED", voucherStatus(voucher));
        assertEquals(1, promoUsed(promo));
        assertEquals(2, reserved(product));

        Res cancel = api.post("/api/v1/orders/" + code + "/cancel", c.token(), null);
        assertEquals(200, cancel.status(), cancel.json().toString());
        assertEquals("CANCELLED", cancel.str("status"));
        assertEquals(200, balance(c.id()), "spent points come back");
        assertEquals("AVAILABLE", voucherStatus(voucher));
        assertNull(jdbc.queryForObject("SELECT used_order_id FROM vouchers WHERE code=?", Long.class, voucher));
        assertEquals(0, promoUsed(promo));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM promotion_redemptions r JOIN orders o ON o.id=r.order_id WHERE o.code=?",
            Integer.class, code));
        assertEquals(0, reserved(product));
        assertEquals(10, onHand(product));

        // Cancelling again must not refund again.
        Res again = api.post("/api/v1/orders/" + code + "/cancel", c.token(), null);
        assertEquals(409, again.status());
        assertEquals("ORDER_NOT_CANCELLABLE", again.code());
        assertEquals(200, balance(c.id()));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM loyalty_ledger WHERE ref_id=? AND reason='ORDER_CANCEL_REFUND'",
            Integer.class, code));
        assertEquals(0, promoUsed(promo));

        // The freed voucher and promo are usable again.
        var second = checkoutBody(c, product, 1);
        second.put("promoCode", promo);
        second.put("voucherCode", voucher);
        assertEquals(201, checkout(c, second, unique("idem")).status());
        assertEquals("USED", voucherStatus(voucher));
        assertEquals(1, promoUsed(promo));
    }

    @Test
    void staffCancelRefundsToo_andACustomerCannotCancelSomeoneElsesOrder() {
        long product = newProduct(Q7, 100_000, 10);
        Customer c = newCustomer();
        Customer stranger = newCustomer();
        grantPoints(c.id(), 100);
        var body = checkoutBody(c, product, 1);
        body.put("usePoints", 40);
        String code = checkout(c, body, unique("idem")).str("code");
        assertEquals(60, balance(c.id()));

        assertEquals(404, api.post("/api/v1/orders/" + code + "/cancel", stranger.token(), null).status());
        assertEquals(60, balance(c.id()));

        String staff = staffToken("STAFF", Q7);
        Res r = api.post("/api/v1/admin/orders/" + code + "/status", staff, Api.map("status", "CANCELLED"));
        assertEquals(200, r.status(), r.json().toString());
        assertEquals(100, balance(c.id()));
        assertEquals(409, api.post("/api/v1/admin/orders/" + code + "/status", staff, Api.map("status", "CANCELLED")).status());
        assertEquals(100, balance(c.id()));
    }

    @Test
    void usingMorePointsThanOwnedIsRejectedAndNothingIsReserved() {
        long product = newProduct(Q7, 100_000, 10);
        Customer c = newCustomer();
        grantPoints(c.id(), 10);
        var body = checkoutBody(c, product, 1);
        body.put("usePoints", 11);
        Res r = checkout(c, body, unique("idem"));
        assertEquals("INSUFFICIENT_POINTS", r.code());
        assertEquals(0, reserved(product));
        assertEquals(10, balance(c.id()));
    }
}
