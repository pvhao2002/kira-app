package com.kira.farm.it;

import com.kira.farm.it.Api.Res;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;

class CheckoutIT extends IntegrationTestBase {

    @Test
    void checkoutReservesStockAndComputesTotalsFromTheDatabase() {
        long product = newProduct(Q7, 120_000, 10);
        Customer c = newCustomer();
        Res r = checkout(c, product, 3);
        assertEquals(201, r.status(), r.json().toString());
        assertEquals("PENDING", r.str("status"));
        assertEquals(360_000, r.num("subtotal"));
        assertEquals(360_000, r.num("total")); // PICKUP: no shipping, no tier perk yet
        assertEquals(10, onHand(product));
        assertEquals(3, reserved(product));
    }

    @Test
    void idempotentReplayReturnsTheSameOrderAndReservesOnce() {
        long product = newProduct(Q7, 50_000, 10);
        Customer c = newCustomer();
        String key = unique("idem");
        Res first = checkout(c, checkoutBody(c, product, 2), key);
        Res again = checkout(c, checkoutBody(c, product, 2), key);
        assertEquals(201, first.status());
        assertEquals(201, again.status());
        assertEquals(first.str("code"), again.str("code"));
        assertEquals(first.num("id"), again.num("id"));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM orders WHERE user_id=?", Integer.class, c.id()));
        assertEquals(2, reserved(product), "replay must not reserve a second time");
        // A different key is a different order.
        Res other = checkout(c, checkoutBody(c, product, 1), unique("idem"));
        assertNotEquals(first.str("code"), other.str("code"));
        assertEquals(3, reserved(product));
    }

    @Test
    void missingOrMalformedIdempotencyKeyIsRejected() {
        long product = newProduct(Q7, 50_000, 5);
        Customer c = newCustomer();
        assertEquals("IDEMPOTENCY_KEY_REQUIRED",
            api.post("/api/v1/orders", c.token(), checkoutBody(c, product, 1)).code());
        assertEquals("IDEMPOTENCY_KEY_INVALID", checkout(c, checkoutBody(c, product, 1), "x").code());
        assertEquals(0, reserved(product));
    }

    @Test
    void oversellIsRejectedWith409AndStockIsUntouched() {
        long product = newProduct(Q7, 50_000, 3);
        Customer c = newCustomer();
        Res r = checkout(c, product, 5);
        assertEquals(409, r.status());
        assertEquals("INSUFFICIENT_STOCK", r.code());
        assertEquals(3, onHand(product));
        assertEquals(0, reserved(product));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM orders WHERE user_id=?", Integer.class, c.id()),
            "a failed checkout must roll the order back");
    }

    @Test
    void partialFailureRollsBackEarlierLines() {
        long plenty = newProduct(Q7, 10_000, 10);
        long scarce = newProduct(Q7, 10_000, 1);
        Customer c = newCustomer();
        var body = checkoutBody(c, plenty, 4);
        body.put("items", List.of(Api.map("productId", plenty, "quantity", 4), Api.map("productId", scarce, "quantity", 2)));
        Res r = checkout(c, body, unique("idem"));
        assertEquals("INSUFFICIENT_STOCK", r.code());
        assertEquals(0, reserved(plenty), "reservation of the first line must be rolled back");
        assertEquals(0, reserved(scarce));
    }

    @Test
    void parallelCheckoutsNeverOversell() throws Exception {
        final int stock = 7, qty = 2, buyers = 12;
        long product = newProduct(Q7, 30_000, stock);
        List<Customer> customers = new ArrayList<>();
        for (int i = 0; i < buyers; i++) customers.add(newCustomer());

        ExecutorService pool = Executors.newFixedThreadPool(buyers);
        CountDownLatch go = new CountDownLatch(1);
        List<Future<Res>> results = new ArrayList<>();
        for (Customer c : customers)
            results.add(pool.submit(() -> {
                go.await();
                return checkout(c, product, qty);
            }));
        go.countDown();
        int created = 0, rejected = 0;
        for (Future<Res> f : results) {
            Res r = f.get(60, TimeUnit.SECONDS);
            if (r.status() == 201) created++;
            else {
                assertEquals(409, r.status(), r.json().toString());
                assertEquals("INSUFFICIENT_STOCK", r.code());
                rejected++;
            }
        }
        pool.shutdown();

        assertEquals(stock / qty, created, "exactly floor(stock/qty) checkouts may succeed");
        assertEquals(buyers - created, rejected);
        assertEquals(stock, onHand(product));
        assertEquals(created * qty, reserved(product));
        assertTrue(onHand(product) - reserved(product) >= 0, "available must never go negative");
        assertEquals(created, jdbc.queryForObject(
            "SELECT COUNT(*) FROM order_items WHERE product_id=?", Integer.class, product));
        // Order codes handed out concurrently are unique.
        assertEquals(created, jdbc.queryForObject(
            "SELECT COUNT(DISTINCT o.code) FROM orders o JOIN order_items i ON i.order_id=o.id WHERE i.product_id=?",
            Integer.class, product));
    }
}
