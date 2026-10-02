package com.kira.farm.it;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** Context load = Flyway V1..V7 applied and every JPQL/native repository query validated against real MySQL. */
class SchemaAndContextIT extends IntegrationTestBase {

    @Test
    void flywayAppliedAllMigrationsCleanly() {
        List<String> versions = jdbc.queryForList(
            "SELECT version FROM flyway_schema_history WHERE success = 1 ORDER BY installed_rank", String.class);
        assertEquals(List.of("1", "2", "3", "4", "5", "6", "7"), versions);
        // V2 reference data, V3 column, V5 columns exist.
        assertEquals(5, jdbc.queryForObject("SELECT COUNT(*) FROM branches", Integer.class));
        assertEquals(6, jdbc.queryForObject("SELECT COUNT(*) FROM categories", Integer.class));
        assertEquals(2, jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() "
            + "AND ((table_name='orders' AND column_name='tier_discount') OR (table_name='users' AND column_name='totp_last_step'))",
            Integer.class));
    }

    @Test
    void developmentSeederCreatedDemoUsersWithOtpEnrolled() {
        assertEquals(1, jdbc.queryForObject(
            "SELECT COUNT(*) FROM users WHERE email='admin@kirafarm.vn' AND role='ADMIN' AND totp_enabled = 1", Integer.class));
        assertEquals(2, jdbc.queryForObject("SELECT COUNT(*) FROM user_branch_assignments a JOIN users u ON u.id=a.user_id "
            + "WHERE u.email='ngoc.le@kirafarm.vn'", Integer.class));
    }

    @Test
    void readQueriesBackedByNativeAndJpqlRunAgainstMysql() {
        var admin = staffToken("ADMIN");
        for (String path : List.of("/api/v1/branches", "/api/v1/categories", "/api/v1/products",
            "/api/v1/admin/orders", "/api/v1/admin/inventory", "/api/v1/admin/promotions", "/api/v1/admin/products",
            "/api/v1/admin/users", "/api/v1/admin/branches", "/api/v1/admin/inventory/movements")) {
            var r = api.get(path, path.startsWith("/api/v1/admin") ? admin : null);
            assertEquals(200, r.status(), path + " -> " + r.json());
        }
        var c = newCustomer();
        for (String path : List.of("/api/v1/orders", "/api/v1/loyalty/summary", "/api/v1/loyalty/history",
            "/api/v1/loyalty/vouchers", "/api/v1/addresses", "/api/v1/auth/me")) {
            var r = api.get(path, c.token());
            assertEquals(200, r.status(), path + " -> " + r.json());
        }
    }
}
