package com.kira.farm.it;

import com.kira.farm.identity.application.Totp;
import com.kira.farm.identity.application.TotpCrypto;
import com.kira.farm.it.Api.Res;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MySQLContainer;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Shared base of every *IT: ONE MySQL container for the whole JVM (singleton, never stopped explicitly; run with
 * TESTCONTAINERS_RYUK_DISABLED=true, failsafe sets it) and one Spring context. Flyway V1..V5 run on startup, the
 * dev seeder creates the demo users. Tests isolate themselves by creating their own customers/products/staff.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "app.seed-development-users=true",
    "app.seed-development-password=" + IntegrationTestBase.PASSWORD,
    "app.seed-development-totp-secret=" + IntegrationTestBase.TOTP_SECRET,
    "app.refresh-cookie-secure=false"})
public abstract class IntegrationTestBase {
    public static final String PASSWORD = "Doinang@123";
    public static final String TOTP_SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
    public static final long Q7 = 1, Q3 = 2, TD = 3, DL = 5; // branch ids fixed by V2

    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.0");

    static {
        MYSQL.start();
    }

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", MYSQL::getJdbcUrl);
        r.add("spring.datasource.username", MYSQL::getUsername);
        r.add("spring.datasource.password", MYSQL::getPassword);
    }

    @Autowired protected TestRestTemplate rest;
    @Autowired protected JdbcTemplate jdbc;
    @Autowired PasswordEncoder encoder;
    @Autowired TotpCrypto totpCrypto;
    protected Api api;
    private static final AtomicInteger SEQ = new AtomicInteger();

    @BeforeEach
    void initApi() {
        api = new Api(rest);
    }

    protected static String unique(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8) + SEQ.incrementAndGet();
    }

    // ---- customers --------------------------------------------------------------------------------------------

    public record Customer(long id, String email, String token, long addressId) {
    }

    /** Registers a fresh customer through the public API and gives them a delivery address. */
    protected Customer newCustomer() {
        String email = unique("cust") + "@test.vn";
        Res reg = api.post("/api/v1/auth/register", null,
            Api.map("fullName", "Khách Test", "email", email, "password", PASSWORD));
        assertEquals(201, reg.status(), reg.json().toString());
        String token = reg.str("accessToken");
        Res addr = api.post("/api/v1/addresses", token, Api.map("label", "Nhà", "recipient", "Khách Test",
            "phone", "0912345678", "line1", "1 Test", "city", "TP.HCM", "makeDefault", true));
        assertEquals(201, addr.status(), addr.json().toString());
        return new Customer(reg.json().path("user").path("id").asLong(), email, token, addr.num("id"));
    }

    protected long balance(long userId) {
        return jdbc.queryForObject("SELECT COALESCE(SUM(delta),0) FROM loyalty_ledger WHERE user_id=?", Long.class, userId);
    }

    protected void grantPoints(long userId, int points) {
        jdbc.update("INSERT INTO loyalty_ledger (user_id, delta, reason, ref_type, ref_id, created_at) "
            + "VALUES (?,?,'TEST_GRANT','TEST',?,UTC_TIMESTAMP(6))", userId, points, UUID.randomUUID().toString());
    }

    // ---- back office ------------------------------------------------------------------------------------------

    /** Inserts an ACTIVE staff/manager/admin with OTP already enrolled (shared dev secret) and returns the email. */
    protected String newBackoffice(String role, long... branchIds) {
        String email = unique(role.toLowerCase()) + "@test.vn";
        jdbc.update("INSERT INTO users (email, password_hash, full_name, role, status, created_at, updated_at, "
                + "totp_secret, totp_enabled) VALUES (?,?,?,?,'ACTIVE',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6),?,TRUE)",
            email, encoder.encode(PASSWORD), role + " Test", role, totpCrypto.encrypt(TOTP_SECRET));
        long id = userId(email);
        for (long b : branchIds) jdbc.update("INSERT INTO user_branch_assignments (user_id, branch_id) VALUES (?,?)", id, b);
        return email;
    }

    protected long userId(String email) {
        return jdbc.queryForObject("SELECT id FROM users WHERE email=?", Long.class, email);
    }

    /** Password step of the back-office login; returns the challenge token. */
    protected String challenge(String email) {
        Res r = api.post("/api/v1/auth/login", null, Api.map("identifier", email, "password", PASSWORD));
        assertEquals(200, r.status(), r.json().toString());
        return r.str("challengeToken");
    }

    /** Valid TOTP code for the current 30s step (the project's own Totp class). */
    protected static String currentCode() {
        return Totp.code(Totp.fromBase32(TOTP_SECRET), Totp.stepAt(Instant.now().getEpochSecond()));
    }

    /**
     * Full staff login. Clears users.totp_last_step first so several logins of one user within the same 30s step
     * do not trip the replay guard (the replay rule itself is covered in AuthIT).
     */
    protected String login(String email) {
        jdbc.update("UPDATE users SET totp_last_step=NULL WHERE email=?", email);
        Res r = api.post("/api/v1/auth/otp/verify", null,
            Api.map("challengeToken", challenge(email), "code", currentCode()));
        assertEquals(200, r.status(), r.json().toString());
        return r.str("accessToken");
    }

    /** One-call helper: new back-office user + token. */
    protected String staffToken(String role, long... branchIds) {
        return login(newBackoffice(role, branchIds));
    }

    // ---- catalogue --------------------------------------------------------------------------------------------

    /** Inserts an ACTIVE product with stock straight into MySQL; returns its id. */
    protected long newProduct(long branchId, long price, int stock) {
        String sku = unique("SKU");
        jdbc.update("INSERT INTO products (branch_id, category_id, sku, name, slug, price, unit, status, created_at, "
            + "updated_at) VALUES (?,1,?,?,?,?,'kg','ACTIVE',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))",
            branchId, sku, "Sản phẩm " + sku, sku.toLowerCase(), price);
        long id = jdbc.queryForObject("SELECT id FROM products WHERE branch_id=? AND sku=?", Long.class, branchId, sku);
        jdbc.update("INSERT INTO inventory (branch_id, product_id, on_hand, reserved, updated_at) "
            + "VALUES (?,?,?,0,UTC_TIMESTAMP(6))", branchId, id, stock);
        return id;
    }

    protected int onHand(long productId) {
        return jdbc.queryForObject("SELECT on_hand FROM inventory WHERE product_id=?", Integer.class, productId);
    }

    protected int reserved(long productId) {
        return jdbc.queryForObject("SELECT reserved FROM inventory WHERE product_id=?", Integer.class, productId);
    }

    // ---- checkout ---------------------------------------------------------------------------------------------

    protected static Map<String, Object> checkoutBody(Customer c, long productId, int qty) {
        return Api.map("addressId", c.addressId(), "items", List.of(Api.map("productId", productId, "quantity", qty)),
            "shippingMethod", "PICKUP", "paymentMethod", "COD");
    }

    protected Res checkout(Customer c, Map<String, Object> body, String idempotencyKey) {
        return api.post("/api/v1/orders", c.token(), body, Map.of("Idempotency-Key", idempotencyKey));
    }

    protected Res checkout(Customer c, long productId, int qty) {
        return checkout(c, checkoutBody(c, productId, qty), unique("idem"));
    }
}
