package com.kira.farm.it;

import com.fasterxml.jackson.databind.JsonNode;
import com.zaxxer.hikari.HikariDataSource;
import com.kira.farm.it.Api.Res;
import jakarta.persistence.EntityManagerFactory;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;

import javax.sql.DataSource;

import static org.junit.jupiter.api.Assertions.*;

/** Runtime configuration from application.yml: pool, Hibernate batching, probes, compression, graceful shutdown. */
class OperationalConfigIT extends IntegrationTestBase {
    @Autowired Environment env;
    @Autowired DataSource dataSource;
    @Autowired EntityManagerFactory emf;

    @Test
    void virtualThreadsGracefulShutdownAndPoolSettingsAreActive() throws Exception {
        assertEquals("true", env.getProperty("spring.threads.virtual.enabled"));
        assertEquals("graceful", env.getProperty("server.shutdown"));
        assertEquals("30s", env.getProperty("spring.lifecycle.timeout-per-shutdown-phase"));
        HikariDataSource pool = dataSource.unwrap(HikariDataSource.class);
        assertEquals(20, pool.getMaximumPoolSize());
        assertEquals(5_000, pool.getConnectionTimeout());
        assertEquals(1_740_000, pool.getMaxLifetime());
        assertEquals(0, pool.getLeakDetectionThreshold(), "leak detection is off unless DB_LEAK_DETECTION_MS is set");
        assertTrue(pool.getMaxLifetime() < 8L * 3600 * 1000, "below MySQL wait_timeout (default 8h)");
    }

    @Test
    void hibernateBatchingAndBatchFetchingAreConfigured() {
        var props = emf.getProperties();
        assertEquals("50", String.valueOf(props.get("hibernate.jdbc.batch_size")));
        assertEquals("true", String.valueOf(props.get("hibernate.order_inserts")));
        assertEquals("true", String.valueOf(props.get("hibernate.order_updates")));
        assertEquals("32", String.valueOf(props.get("hibernate.default_batch_fetch_size")));
    }

    @Test
    void livenessAndReadinessProbesArePublicAndHideDetails() {
        for (String probe : new String[]{"/actuator/health", "/actuator/health/liveness", "/actuator/health/readiness"}) {
            Res r = api.get(probe, null);
            assertEquals(200, r.status(), probe);
            assertEquals("UP", r.str("status"), probe);
            assertFalse(r.json().has("components") || r.json().has("details"), probe + " must not expose details: " + r.json());
        }
    }

    @Test
    void metricsAndInfoAreAdminOnly() {
        assertEquals(401, api.get("/actuator/metrics", null).status());
        assertEquals(403, api.get("/actuator/metrics", newCustomer().token()).status());
        assertEquals(403, api.get("/actuator/info", staffToken("STAFF", Q7)).status());
        Res ok = api.get("/actuator/metrics", staffToken("ADMIN"));
        assertEquals(200, ok.status());
        JsonNode names = ok.json().path("names");
        assertTrue(names.toString().contains("hikaricp.connections"), "pool metrics are bound");
        assertTrue(names.toString().contains("http.server.requests"));
    }

    @Test
    void largeJsonResponsesAreGzipped() {
        for (int i = 0; i < 20; i++) newProduct(Q7, 10_000 + i, 5);
        var headers = new HttpHeaders();
        headers.set(HttpHeaders.ACCEPT_ENCODING, "gzip");
        var r = rest.exchange("/api/v1/products?size=48", HttpMethod.GET, new HttpEntity<>(headers), byte[].class);
        assertEquals(200, r.getStatusCode().value());
        assertEquals("gzip", r.getHeaders().getFirst(HttpHeaders.CONTENT_ENCODING));
        assertEquals(0x1f, r.getBody()[0] & 0xff, "gzip magic number");
    }
}
