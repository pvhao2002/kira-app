package com.kira.affiliate.it;

import com.kira.affiliate.it.Api.Res;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MySQLContainer;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.fail;

/** One MySQL container, one stub Shopee server and one Spring context for every *IT. Tests create their own users. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "app.jwt.secret=integration-test-secret-with-at-least-32-chars",
    "shopee.credential-encryption-key=AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=",
    "shopee.sync.enabled=false", "shopee.sync.fresh-query-gap=0s", "shopee.retry-backoff=10ms",
    "app.login-rate-limit.max-attempts-per-ip=100000"})
public abstract class IntegrationTestBase {
    public static final String PASSWORD = "KiraAff@12345";
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.0");
    static final ShopeeStub SHOPEE = new ShopeeStub();
    private static final AtomicInteger SEQ = new AtomicInteger(100000);

    static {
        MYSQL.start();
    }

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", MYSQL::getJdbcUrl);
        r.add("spring.datasource.username", MYSQL::getUsername);
        r.add("spring.datasource.password", MYSQL::getPassword);
        r.add("shopee.endpoint", SHOPEE::endpoint);
    }

    @Autowired protected TestRestTemplate rest;
    @Autowired protected JdbcTemplate jdbc;
    protected Api api;

    @BeforeEach
    void initApi() {
        api = new Api(rest);
    }

    public record TestUser(long id, String email, String token, String refreshCookie) {
    }

    protected TestUser newUser() {
        String email = "u" + UUID.randomUUID().toString().substring(0, 12) + "@test.vn";
        Res r = api.post("/api/v1/auth/register", null, Api.map("email", email, "password", PASSWORD, "fullName", "Người Dùng"));
        assertEquals(200, r.status(), r.json().toString());
        return new TestUser(r.json().path("user").path("id").asLong(), email, r.str("accessToken"), r.cookie("kaff_refresh"));
    }

    /** Registers a user, registers a matching account on the stub and saves the credentials through the API. */
    protected String connect(TestUser user) {
        String appId = String.valueOf(SEQ.incrementAndGet());
        String secret = "secret-" + UUID.randomUUID();
        SHOPEE.accounts.put(appId, new ShopeeStub.Account(secret));
        Res r = api.put("/api/v1/shopee/credentials", user.token(), Api.map("appId", appId, "secret", secret));
        assertEquals(200, r.status(), r.json().toString());
        assertEquals("OK", r.str("lastStatus"), r.json().toString());
        return appId;
    }

    protected Res syncAndWait(TestUser user, String path, Object body) {
        Res started = api.post(path, user.token(), body);
        assertEquals(202, started.status(), started.json().toString());
        for (int i = 0; i < 200; i++) {
            Res status = api.get("/api/v1/sync/status", user.token());
            if (!status.json().path("running").asBoolean()) return status;
            try {
                Thread.sleep(50);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        return fail("sync did not finish");
    }
}
