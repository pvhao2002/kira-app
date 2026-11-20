package com.matchmind.it;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.containers.PostgreSQLContainer;

import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/** Real PostgreSQL (Testcontainers) + Flyway + full security chain through MockMvc. One container for all ITs. */
@SpringBootTest
@AutoConfigureMockMvc
public abstract class IntegrationTestBase {
    static final String ADMIN = "admin";
    static final String ADMIN_PASSWORD = "admin-password-123";
    static final String EXTERNAL_KEY = "test-external-key-0123456789-abcdefghij";
    static final String SHEET_URL = "https://docs.google.com/spreadsheets/d/test-sheet/edit";
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine")
        .withDatabaseName("matchmind_db");

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        r.add("spring.datasource.username", POSTGRES::getUsername);
        r.add("spring.datasource.password", POSTGRES::getPassword);
        r.add("app.jwt.secret", () -> "test-secret-test-secret-test-secret-0123456789");
        r.add("app.bootstrap-admin.username", () -> ADMIN);
        r.add("app.bootstrap-admin.password", () -> ADMIN_PASSWORD);
        r.add("app.login-rate-limit.max-attempts-per-ip", () -> "1000");
        r.add("app.external-api-key", () -> EXTERNAL_KEY);
        r.add("app.matchmind-sheet-url", () -> SHEET_URL);
    }

    @Autowired
    protected MockMvc mvc;
    @Autowired
    protected ObjectMapper json;
    @Autowired
    protected JdbcTemplate db;

    protected String adminToken;

    @BeforeEach
    void loginAdmin() throws Exception {
        adminToken = login(ADMIN, ADMIN_PASSWORD);
    }

    protected String login(String username, String password) throws Exception {
        MvcResult res = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("username", username, "password", password)))).andReturn();
        if (res.getResponse().getStatus() != 200) throw new AssertionError("login failed: " + res.getResponse().getContentAsString());
        return read(res).get("accessToken").asText();
    }

    protected JsonNode read(MvcResult res) throws Exception {
        String body = res.getResponse().getContentAsString();
        return body.isEmpty() ? json.nullNode() : json.readTree(body);
    }

    protected MockHttpServletRequestBuilder asAdmin(MockHttpServletRequestBuilder b) {
        return b.header("Authorization", "Bearer " + adminToken);
    }

    protected JsonNode adminPost(String url, Object body) throws Exception {
        MvcResult res = mvc.perform(asAdmin(post(url)).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(body))).andReturn();
        if (res.getResponse().getStatus() >= 300) throw new AssertionError(url + " -> " + res.getResponse().getStatus()
            + " " + res.getResponse().getContentAsString());
        return read(res);
    }

    protected JsonNode adminGet(String url) throws Exception {
        MvcResult res = mvc.perform(asAdmin(get(url))).andReturn();
        if (res.getResponse().getStatus() >= 300) throw new AssertionError(url + " -> " + res.getResponse().getStatus()
            + " " + res.getResponse().getContentAsString());
        return read(res);
    }

    /** A fresh provider code and model name; both are created by the first external call that uses them. */
    protected record Integration(String provider, String modelName) {
    }

    protected Integration newIntegration(String modelName) {
        return new Integration("p" + UUID.randomUUID().toString().substring(0, 8), modelName);
    }

    protected UUID providerId(Integration in) {
        return db.queryForObject("SELECT id FROM providers WHERE code = ?", UUID.class, in.provider());
    }

    /** Calls an external endpoint with the shared key as {@code provider}; the model comes from the body. */
    protected MvcResult external(String provider, String path, String body) throws Exception {
        return externalWith(Map.of("X-Api-Key", EXTERNAL_KEY, "X-Provider", provider), path, body);
    }

    protected MvcResult externalWith(Map<String, String> headers, String path, String body) throws Exception {
        MockHttpServletRequestBuilder b = post("/api/v1/external/" + path).contentType(MediaType.APPLICATION_JSON).content(body);
        headers.forEach(b::header);
        return mvc.perform(b).andReturn();
    }
}
