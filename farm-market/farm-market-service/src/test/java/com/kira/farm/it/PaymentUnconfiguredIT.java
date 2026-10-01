package com.kira.farm.it;

import com.kira.farm.it.Api.Res;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** Default context (no bank account configured): no QR or bank fields, staff can still reconcile manually. */
class PaymentUnconfiguredIT extends IntegrationTestBase {
    @Test
    void noQrFieldsWhenBankIsNotConfigured() {
        long product = newProduct(Q7, 100_000, 10);
        Customer c = newCustomer();
        var body = checkoutBody(c, product, 1);
        body.put("paymentMethod", "BANK_TRANSFER");
        Res r = checkout(c, body, unique("idem"));
        assertEquals(201, r.status(), r.json().toString());
        var p = r.json().path("payment");
        assertEquals("UNPAID", p.path("status").asText());
        for (String f : new String[]{"qrUrl", "bankName", "accountNo", "accountName", "transferNote"})
            assertTrue(p.path(f).isNull() || p.path(f).isMissingNode(), f);
        assertEquals(200, api.post("/api/v1/admin/orders/" + r.str("code") + "/payment", staffToken("STAFF", Q7),
            Api.map("status", "PAID")).status());
    }
}
