package com.kira.farm.it;

import com.kira.farm.it.Api.Res;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Statements-per-request measurement (see {@link SqlCounter}) over realistic data, with generous upper bounds as a
 * regression net: a count that grows with page size means an N+1 came back. Prints a table and writes it to
 * target/query-counts.txt.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class QueryCountIT extends IntegrationTestBase {
    private static final boolean MEASURE_ONLY = System.getenv("QC_BASELINE") != null;
    private static final long[] BRANCHES = {Q7, Q3, TD, DL};

    private Customer customer;
    private String admin;
    private String groupedSlug;
    private String lastOrderCode;
    private final long[] spare = new long[3];
    private final Map<String, Integer> measured = new LinkedHashMap<>();
    private final Map<String, Integer> rows = new LinkedHashMap<>();

    @BeforeAll
    void seed() {
        api = new Api(rest);
        // 30 products over 4 branches / 6 categories; two of them form a group across branches.
        long group = insertGroup();
        long a = product(Q7, 1, 21_000, 500, group);
        product(Q3, 1, 22_000, 50, group);
        groupedSlug = slugOf(a);
        int q7Seen = 1;
        spare[0] = a;
        for (int i = 0; i < 28; i++) {
            long branch = BRANCHES[i % 4];
            long id = product(branch, 1 + i % 6, 23_000 + i * 1_000L, 500, null);
            if (branch == Q7 && q7Seen < 3) spare[q7Seen++] = id;
        }

        customer = newCustomer();
        admin = staffToken("ADMIN");
        for (int i = 0; i < 10; i++) {
            Res r = checkout(customer, order(customer, spare), unique("idem"));
            assertEquals(201, r.status(), r.json().toString());
            lastOrderCode = r.str("code");
        }
        for (int k = 1; k <= 5; k++) cloneOrders(k); // 60 orders in total so admin lists can fill a 50-row page
        jdbc.update("UPDATE orders SET status='DELIVERED' WHERE user_id=? ORDER BY id LIMIT 6", customer.id());
        jdbc.update("INSERT INTO reviews (user_id, product_id, order_id, rating, body, has_photo, created_at) "
            + "SELECT o.user_id, i.product_id, o.id, 5, 'ok', 0, UTC_TIMESTAMP(6) FROM orders o JOIN order_items i "
            + "ON i.order_id = o.id WHERE o.user_id=? AND o.status='DELIVERED' ORDER BY o.id, i.id LIMIT 6", customer.id());
        jdbc.update("INSERT INTO wishlist_items (user_id, product_id, created_at) SELECT ?, id, UTC_TIMESTAMP(6) "
            + "FROM products WHERE status='ACTIVE' ORDER BY id DESC LIMIT 10", customer.id());
        for (int i = 0; i < 25; i++) grantPoints(customer.id(), 10);
    }

    @Test
    void statementsPerRequest() {
        api = new Api(rest);
        long[] fresh = {newProduct(Q7, 10_000, 100), newProduct(Q7, 11_000, 100), newProduct(Q7, 12_000, 100)};
        String c = customer.token();
        measure("GET /products?size=12", () -> api.get("/api/v1/products?size=12", null), 6);
        measure("GET /products?size=48", () -> api.get("/api/v1/products?size=48", null), 6);
        measure("GET /products/{slug} (grouped)", () -> api.get("/api/v1/products/" + groupedSlug, null), 6);
        measure("GET /orders?size=5", () -> api.get("/api/v1/orders?size=5", c), 6);
        measure("GET /orders?size=10", () -> api.get("/api/v1/orders?size=10", c), 6);
        measure("GET /admin/orders?size=10", () -> api.get("/api/v1/admin/orders?size=10", admin), 9);
        measure("GET /admin/orders?size=50", () -> api.get("/api/v1/admin/orders?size=50", admin), 9);
        measure("GET /admin/orders/{code}", () -> api.get("/api/v1/admin/orders/" + lastOrderCode, admin), 10);
        measure("GET /admin/dashboard", () -> api.get("/api/v1/admin/dashboard", admin), 10);
        measure("GET /wishlist?branchId=", () -> api.get("/api/v1/wishlist?branchId=" + Q3, c), 7);
        measure("GET /admin/inventory?size=20", () -> api.get("/api/v1/admin/inventory?size=20", admin), 6);
        measure("GET /admin/inventory?size=50", () -> api.get("/api/v1/admin/inventory?size=50", admin), 6);
        measure("GET /reviews/pending", () -> api.get("/api/v1/reviews/pending", c), 4);
        measure("GET /loyalty/history", () -> api.get("/api/v1/loyalty/history", c), 5);
        measure("GET /admin/customers", () -> api.get("/api/v1/admin/customers", admin), 6);
        measure("GET /branches", () -> api.get("/api/v1/branches", null), 3);
        measure("GET /categories", () -> api.get("/api/v1/categories", null), 4);
        measure("POST /orders (3 lines)", () -> checkout(customer, order(customer, fresh), unique("idem")), 22, false);

        StringBuilder t = new StringBuilder(String.format("%-36s %6s %s%n", "request", "stmts", "rows"));
        measured.forEach((k, v) -> t.append(String.format("%-36s %6d %s%n", k, v, rows.get(k))));
        System.out.println("\n=== statements per request ===\n" + t);
        try {
            Files.writeString(Path.of("target/query-counts.txt"), t.toString());
        } catch (Exception ignored) {
            // report only
        }
        // flat in page size: more rows must not mean more statements
        if (MEASURE_ONLY) return;
        assertTrue(rows.get("GET /products?size=48") > rows.get("GET /products?size=12"));
        assertTrue(measured.get("GET /products?size=48") <= measured.get("GET /products?size=12"), "products N+1");
        assertTrue(measured.get("GET /admin/orders?size=50") <= measured.get("GET /admin/orders?size=10"), "admin orders N+1");
        assertTrue(measured.get("GET /admin/inventory?size=50") <= measured.get("GET /admin/inventory?size=20"), "inventory N+1");
        assertTrue(measured.get("GET /orders?size=10") <= measured.get("GET /orders?size=5"), "orders N+1");
    }

    private void measure(String label, Supplier<Res> call, int max) {
        measure(label, call, max, true);
    }

    private void measure(String label, Supplier<Res> call, int max, boolean repeatable) {
        if (repeatable) call.get(); // warm-up
        SqlCounter.reset();
        Res r = call.get();
        int n = SqlCounter.count();
        if (MEASURE_ONLY) { System.out.println("### " + label); SqlCounter.statements().forEach(s -> { String n1 = s.replaceAll("\s+", " "); System.out.println("   " + n1.substring(0, Math.min(150, n1.length()))); }); }
        if (MEASURE_ONLY) { System.out.println("### " + label); SqlCounter.statements().forEach(s -> System.out.println("   " + s.replaceAll("\s+", " ").substring(0, Math.min(150, s.length())))); }
        measured.put(label, n);
        rows.put(label, r.json().path("data").isArray() ? r.json().path("data").size()
            : r.json().isArray() ? r.json().size() : -1);
        if (!MEASURE_ONLY) assertTrue(n <= max, label + " executed " + n + " statements (max " + max + "): " + SqlCounter.statements());
    }

    private static Map<String, Object> order(Customer c, long[] products) {
        return Api.map("addressId", c.addressId(), "shippingMethod", "PICKUP", "paymentMethod", "COD", "items",
            List.of(Api.map("productId", products[0], "quantity", 1), Api.map("productId", products[1], "quantity", 2),
                Api.map("productId", products[2], "quantity", 3)));
    }

    /** Copies the customer's first 10 orders (and their lines) under new codes / idempotency keys. */
    private void cloneOrders(int k) {
        String sfx = "-c" + k;
        jdbc.update("INSERT INTO orders (code, user_id, branch_id, status, payment_method, payment_status, shipping_method, "
            + "shipping_fee, subtotal, discount, tier_discount, points_used, points_discount, total, ship_recipient, ship_phone, "
            + "ship_line1, idempotency_key, created_at, updated_at) SELECT CONCAT(code, ?), ?, branch_id, status, "
            + "payment_method, payment_status, shipping_method, shipping_fee, subtotal, discount, tier_discount, points_used, "
            + "points_discount, total, ship_recipient, ship_phone, ship_line1, CONCAT(idempotency_key, ?), UTC_TIMESTAMP(6), "
            + "UTC_TIMESTAMP(6) FROM orders WHERE user_id=? AND code NOT LIKE '%-c%'", sfx, otherCustomer(k), sfx, customer.id());
        jdbc.update("INSERT INTO order_items (order_id, product_id, sku, product_name, unit, unit_price, quantity, line_total) "
            + "SELECT n.id, i.product_id, i.sku, i.product_name, i.unit, i.unit_price, i.quantity, i.line_total FROM order_items i "
            + "JOIN orders o ON o.id = i.order_id JOIN orders n ON n.code = CONCAT(o.code, ?) WHERE o.user_id=?",
            sfx, customer.id());
    }

    /** A bare CUSTOMER row (no login needed) so admin lists show several distinct buyers. */
    private long otherCustomer(int k) {
        String email = unique("buyer" + k) + "@test.vn";
        jdbc.update("INSERT INTO users (email, password_hash, full_name, role, status, created_at, updated_at) "
            + "VALUES (?, 'x', ?, 'CUSTOMER', 'ACTIVE', UTC_TIMESTAMP(6), UTC_TIMESTAMP(6))", email, "Người mua " + k);
        return userId(email);
    }

    private long insertGroup() {
        String code = unique("grp");
        jdbc.update("INSERT INTO product_groups (code, name) VALUES (?,?)", code, "Nhóm " + code);
        return jdbc.queryForObject("SELECT id FROM product_groups WHERE code=?", Long.class, code);
    }

    private long product(long branch, int category, long price, int stock, Long group) {
        String sku = unique("QC");
        jdbc.update("INSERT INTO products (branch_id, group_id, category_id, sku, name, slug, price, unit, status, "
            + "created_at, updated_at) VALUES (?,?,?,?,?,?,?,'kg','ACTIVE',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))",
            branch, group, category, sku, "Sản phẩm " + sku, sku.toLowerCase(), price);
        long id = jdbc.queryForObject("SELECT id FROM products WHERE branch_id=? AND sku=?", Long.class, branch, sku);
        jdbc.update("INSERT INTO inventory (branch_id, product_id, on_hand, reserved, updated_at) "
            + "VALUES (?,?,?,0,UTC_TIMESTAMP(6))", branch, id, stock);
        return id;
    }

    private String slugOf(long id) {
        return jdbc.queryForObject("SELECT slug FROM products WHERE id=?", String.class, id);
    }
}
