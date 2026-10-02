package com.kira.farm.it;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.jdbc.core.ConnectionCallback;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * EXPLAIN evidence for the V6 indexes. Production-shaped volumes (150k orders, 20k users) are generated into scratch
 * copies of the tables (CREATE TABLE ... LIKE, so they carry exactly the indexes Flyway created and no foreign keys),
 * the real query shapes are EXPLAINed with the new index and with IGNORE INDEX (= the pre-V6 plan), and the scratch
 * tables are dropped again. Plans are printed and written to target/explain.txt.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class IndexExplainIT extends IntegrationTestBase {
    private static final List<String> TABLES = List.of("orders", "users");
    private final List<String> report = new ArrayList<>();

    private record Plan(String key, long rows, String extra) {
        @Override
        public String toString() {
            return "key=" + key + " rows=" + rows + " extra=" + extra;
        }
    }

    @BeforeAll
    void generate() {
        TABLES.forEach(t -> jdbc.execute("DROP TABLE IF EXISTS xp_" + t));
        TABLES.forEach(t -> jdbc.execute("CREATE TABLE xp_" + t + " LIKE " + t));
        jdbc.execute((ConnectionCallback<Void>) con -> {
            try (var st = con.createStatement()) {
                st.execute("SET SESSION cte_max_recursion_depth = 1000000");
                st.execute("INSERT INTO xp_users (id, email, password_hash, full_name, role, status, created_at, updated_at) "
                    + "WITH RECURSIVE s AS (SELECT 1 n UNION ALL SELECT n + 1 FROM s WHERE n < 20000) "
                    + "SELECT n, CONCAT('u', n, '@x.vn'), 'x', CONCAT('Khach ', n), IF(n % 500 = 0, 'STAFF', 'CUSTOMER'), 'ACTIVE', "
                    + "DATE_SUB(UTC_TIMESTAMP(6), INTERVAL (n % 400) DAY), UTC_TIMESTAMP(6) FROM s");
                st.execute("INSERT INTO xp_orders (id, code, user_id, branch_id, status, payment_method, payment_status, "
                    + "shipping_method, shipping_fee, subtotal, discount, tier_discount, points_used, points_discount, total, "
                    + "ship_recipient, ship_phone, ship_line1, idempotency_key, created_at, updated_at) "
                    + "WITH RECURSIVE s AS (SELECT 1 n UNION ALL SELECT n + 1 FROM s WHERE n < 150000) "
                    + "SELECT n, CONCAT('XP-', n), 1 + (n * 7919) % 20000, ELT(1 + n % 5, 1, 2, 3, 4, 5), "
                    + "ELT(1 + n % 10, 'DELIVERED','DELIVERED','DELIVERED','DELIVERED','DELIVERED','DELIVERED','DELIVERED',"
                    + "'CANCELLED','PENDING','SHIPPING'), 'COD', 'UNPAID', 'STANDARD', 25000, 100000, 0, 0, 0, 0, 125000, "
                    + "'Nguoi nhan', '0900000000', '1 Test', CONCAT('k', n), DATE_SUB(UTC_TIMESTAMP(6), INTERVAL (n % 400) DAY), "
                    + "UTC_TIMESTAMP(6) FROM s");
                for (String t : TABLES) st.execute("ANALYZE TABLE xp_" + t);
            } catch (java.sql.SQLException e) {
                throw new IllegalStateException(e);
            }
            return null;
        });
    }

    @AfterAll
    void cleanup() throws Exception {
        TABLES.forEach(t -> jdbc.execute("DROP TABLE IF EXISTS xp_" + t));
        Files.writeString(Path.of("target/explain.txt"), String.join("\n", report));
    }

    private static final String WINDOW = "o.created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY) AND o.created_at < UTC_TIMESTAMP()";

    @Test
    void dashboardRevenueUsesTheCoveringOrdersIndex() {
        for (String branches : List.of("(3)", "(1,2,3,4,5)")) {
            String sql = "SELECT COALESCE(SUM(total),0), COUNT(*) FROM xp_orders o %s WHERE o.branch_id IN " + branches
                + " AND o.status <> 'CANCELLED' AND " + WINDOW;
            Plan with = compare("dashboard revenue branch IN " + branches, sql, "ix_orders_dashboard");
            assertTrue(with.extra().contains("Using index"), "covering, no clustered-index lookups: " + with);
        }
    }

    @Test
    void dashboardStatusCountsAndDailySeriesUseTheSameIndex() {
        Plan counts = compare("dashboard status counts",
            "SELECT status, COUNT(*) FROM xp_orders o %s WHERE o.branch_id IN (1,2,3,4,5) AND " + WINDOW + " GROUP BY status",
            "ix_orders_dashboard");
        assertTrue(counts.extra().contains("Using index"), counts.toString());
        Plan daily = compare("dashboard daily series",
            "SELECT DATE(DATE_ADD(created_at, INTERVAL 7 HOUR)) d, COALESCE(SUM(total),0), COUNT(*) FROM xp_orders o %s "
                + "WHERE o.branch_id IN (3) AND o.status <> 'CANCELLED' AND " + WINDOW + " GROUP BY d ORDER BY d",
            "ix_orders_dashboard");
        assertTrue(daily.extra().contains("Using index"), daily.toString());
    }

    @Test
    void newCustomerCountersNoLongerScanTheUsersTable() {
        Plan with = compare("new customers today",
            "SELECT COUNT(*) FROM xp_users u %s WHERE u.role = 'CUSTOMER' AND u.created_at >= "
                + "DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY) AND u.created_at < UTC_TIMESTAMP()", "ix_users_role_created");
        assertTrue(with.rows() < 1_000, "range scan, not 20k rows: " + with);
    }

    /** EXPLAINs once as the optimizer chooses and once with the index ignored; the index must win by a wide margin. */
    private Plan compare(String label, String sqlWithHintSlot, String index) {
        Plan without = plan(sqlWithHintSlot.formatted("IGNORE INDEX (" + index + ")"));
        Plan with = plan(sqlWithHintSlot.formatted(""));
        String line = "## " + label + "\n   before (IGNORE INDEX " + index + "): " + without + "\n   after: " + with + "\n";
        report.add(line);
        System.out.println(line);
        assertEquals(index, with.key(), label + " should use " + index);
        assertTrue(with.rows() * 2 <= without.rows() || !without.extra().equals(with.extra()),
            label + ": index must be a clear win. before=" + without + " after=" + with);
        return with;
    }

    private Plan plan(String sql) {
        Map<String, Object> r = jdbc.queryForList("EXPLAIN " + sql).getFirst();
        return new Plan(String.valueOf(r.get("key")), ((Number) r.get("rows")).longValue(), String.valueOf(r.get("Extra")));
    }
}
