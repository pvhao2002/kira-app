package com.kira.farm.it;

import com.kira.farm.it.Api.Res;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.TestPropertySource;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** Bank account configured: BANK_TRANSFER orders carry a VietQR block and staff reconcile payments by hand. */
@TestPropertySource(properties = {"app.payment.bank.bin=970436", "app.payment.bank.name=Vietcombank",
    "app.payment.bank.account-no=0123456789", "app.payment.bank.account-name=CONG TY KIRA FARM"})
class PaymentIT extends IntegrationTestBase {

    private Res placeOrder(Customer c, long product, String method) {
        var body = checkoutBody(c, product, 1);
        body.put("paymentMethod", method);
        Res r = checkout(c, body, unique("idem"));
        assertEquals(201, r.status(), r.json().toString());
        return r;
    }

    private Res pay(String token, String code, String status) {
        return api.post("/api/v1/admin/orders/" + code + "/payment", token, Api.map("status", status, "note", "ck 10h"));
    }

    private int notes(String code) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM order_notes n JOIN orders o ON o.id=n.order_id WHERE o.code=?",
            Integer.class, code);
    }

    @Test
    void bankTransferOrderCarriesQrAndOtherMethodsDoNot() {
        long product = newProduct(Q7, 100_000, 10);
        Customer c = newCustomer();
        Res r = placeOrder(c, product, "BANK_TRANSFER");
        var p = r.json().path("payment");
        assertEquals("BANK_TRANSFER", p.path("method").asText());
        assertEquals("UNPAID", p.path("status").asText());
        assertEquals(r.str("code"), p.path("transferNote").asText());
        assertEquals("Vietcombank", p.path("bankName").asText());
        assertEquals("0123456789", p.path("accountNo").asText());
        assertEquals("https://img.vietqr.io/image/970436-0123456789-compact2.png?amount=" + r.num("total")
            + "&addInfo=" + r.str("code") + "&accountName=CONG%20TY%20KIRA%20FARM", p.path("qrUrl").asText());
        // The owner can read it back; COD / e-wallet orders have no payment block.
        assertEquals(p, api.get("/api/v1/orders/" + r.str("code"), c.token()).json().path("payment"));
        assertTrue(placeOrder(c, product, "COD").json().path("payment").isNull());
        assertTrue(placeOrder(c, product, "EWALLET").json().path("payment").isNull());
    }

    @Test
    void staffMarksPaidIdempotentlyAndCanRevert() {
        long product = newProduct(Q7, 100_000, 10);
        Customer c = newCustomer();
        String code = placeOrder(c, product, "BANK_TRANSFER").str("code");
        String staff = staffToken("STAFF", Q7);

        Res paid = pay(staff, code, "PAID");
        assertEquals(200, paid.status(), paid.json().toString());
        assertEquals("PAID", paid.json().path("order").path("paymentStatus").asText());
        assertEquals("PAID", paid.json().path("order").path("payment").path("status").asText());
        assertEquals(1, notes(code));

        assertEquals(200, pay(staff, code, "PAID").status()); // repeat: no second note
        assertEquals(1, notes(code));
        assertEquals("PAID", api.get("/api/v1/orders/" + code, c.token()).str("paymentStatus"));

        Res back = pay(staff, code, "UNPAID");
        assertEquals("UNPAID", back.json().path("order").path("paymentStatus").asText());
        assertEquals(2, notes(code));
    }

    @Test
    void ewalletCanBeMarkedPaidButCodCannotAndCustomersMayNot() {
        long product = newProduct(Q7, 100_000, 10);
        Customer c = newCustomer();
        String staff = staffToken("STAFF", Q7);

        String wallet = placeOrder(c, product, "EWALLET").str("code");
        assertEquals(200, pay(staff, wallet, "PAID").status());

        String cod = placeOrder(c, product, "COD").str("code");
        Res r = pay(staff, cod, "PAID");
        assertEquals(422, r.status());
        assertEquals("PAYMENT_COD_AUTOMATIC", r.code());

        assertEquals(403, pay(c.token(), wallet, "UNPAID").status());
        assertEquals(401, pay(null, wallet, "UNPAID").status());
    }

    @Test
    void otherBranchStaffGets403AndCancelledOrderGets409() {
        long product = newProduct(Q7, 100_000, 10);
        Customer c = newCustomer();
        String code = placeOrder(c, product, "BANK_TRANSFER").str("code");

        Res foreign = pay(staffToken("STAFF", Q3), code, "PAID");
        assertEquals(403, foreign.status());
        assertEquals("BRANCH_FORBIDDEN", foreign.code());
        assertEquals("UNPAID", api.get("/api/v1/orders/" + code, c.token()).str("paymentStatus"));

        String staff = staffToken("STAFF", Q7);
        assertEquals(200, api.post("/api/v1/admin/orders/" + code + "/status", staff, Map.of("status", "CANCELLED")).status());
        Res cancelled = pay(staff, code, "PAID");
        assertEquals(409, cancelled.status());
        assertEquals("ORDER_CANCELLED", cancelled.code());
    }
}
