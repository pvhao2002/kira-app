package com.kira.farm.it;

import com.kira.farm.identity.application.Totp;
import com.kira.farm.it.Api.Res;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class AuthorizationMatrixIT extends IntegrationTestBase {

    private static java.util.Map<String, Object> productBody(Long branchId) {
        return Api.map("branchId", branchId, "sku", unique("MX"), "name", "Matrix product", "category", "ga",
            "price", 99_000, "unit", "kg", "initialStock", 4);
    }

    @Test
    void anonymousAndCustomerCannotUseAdminEndpoints() {
        Customer c = newCustomer();
        assertEquals(401, api.get("/api/v1/admin/orders", null).status());
        for (String path : new String[]{"/api/v1/admin/orders", "/api/v1/admin/products", "/api/v1/admin/inventory",
            "/api/v1/admin/promotions", "/api/v1/admin/users", "/api/v1/admin/branches"}) {
            Res r = api.get(path, c.token());
            assertEquals(403, r.status(), path);
            assertEquals("FORBIDDEN", r.code(), path);
        }
        assertEquals(403, api.post("/api/v1/admin/products", c.token(), productBody(Q7)).status());
        assertEquals(403, api.put("/api/v1/admin/branches/" + Q7 + "/theme", c.token(),
            Api.map("primary", "#112233", "accent", "#445566")).status());
        // Customers can reach their own endpoints.
        assertEquals(200, api.get("/api/v1/orders", c.token()).status());
    }

    @Test
    void staffCannotCreateUpdateOrHideProductsButCanReadTheirBranch() {
        String staff = staffToken("STAFF", Q7);
        long product = newProduct(Q7, 10_000, 3);
        assertEquals(403, api.post("/api/v1/admin/products", staff, productBody(Q7)).status());
        assertEquals(403, api.put("/api/v1/admin/products/" + product, staff, productBody(Q7)).status());
        assertEquals(403, api.call(org.springframework.http.HttpMethod.DELETE, "/api/v1/admin/products/" + product, staff,
            null, java.util.Map.of()).status());
        assertEquals(403, api.post("/api/v1/admin/promotions", staff, Api.map("code", "NOPE", "type", "FIXED", "value", 5000,
            "minOrder", 0, "startsAt", Instant.now().toString(), "endsAt", Instant.now().plusSeconds(3600).toString(),
            "allBranches", false, "branchIds", java.util.List.of(Q7))).status());
        assertEquals(200, api.get("/api/v1/admin/products?branchId=" + Q7, staff).status());
        assertEquals(403, api.get("/api/v1/admin/products?branchId=" + Q3, staff).status());
    }

    @Test
    void managerIsLimitedToOwnBranches() {
        String manager = staffToken("MANAGER", Q3, TD);
        Res own = api.post("/api/v1/admin/products", manager, productBody(Q3));
        assertEquals(201, own.status(), own.json().toString());
        assertEquals(4, own.json().path("onHand").asInt());

        Res foreign = api.post("/api/v1/admin/products", manager, productBody(Q7));
        assertEquals(403, foreign.status());
        assertEquals("BRANCH_FORBIDDEN", foreign.code());

        long q7Product = newProduct(Q7, 10_000, 3);
        assertEquals(403, api.put("/api/v1/admin/products/" + q7Product, manager, productBody(Q7)).status());
        assertEquals(403, api.get("/api/v1/admin/inventory?branchId=" + Q7, manager).status());
        assertEquals(403, api.post("/api/v1/admin/inventory/receipts", manager,
            Api.map("branchId", Q7, "lines", java.util.List.of(Api.map("productId", q7Product, "quantity", 5)))).status());
        assertEquals(3, onHand(q7Product));
        // ...while receiving into an own branch works.
        long q3Product = newProduct(Q3, 10_000, 3);
        assertEquals(204, api.post("/api/v1/admin/inventory/receipts", manager,
            Api.map("branchId", Q3, "lines", java.util.List.of(Api.map("productId", q3Product, "quantity", 5)))).status());
        assertEquals(8, onHand(q3Product));

        // A branch-scoped promotion is allowed, an all-branches one is admin only.
        var promo = Api.map("code", unique("MGR").toUpperCase(), "type", "FIXED", "value", 5000, "minOrder", 0,
            "startsAt", Instant.now().toString(), "endsAt", Instant.now().plusSeconds(3600).toString(),
            "allBranches", false, "branchIds", java.util.List.of(Q3));
        assertEquals(201, api.post("/api/v1/admin/promotions", manager, promo).status());
        promo.put("code", unique("MGR").toUpperCase());
        promo.put("allBranches", true);
        assertEquals(403, api.post("/api/v1/admin/promotions", manager, promo).status());
    }

    @Test
    void onlyAdminCanChangeBranchThemeAndResetOtp() {
        var theme = Api.map("primary", "#123456", "accent", "#abcdef");
        String themePath = "/api/v1/admin/branches/" + DL + "/theme";
        assertEquals(403, api.put(themePath, staffToken("STAFF", DL), theme).status());
        assertEquals(403, api.put(themePath, staffToken("MANAGER", DL), theme).status());
        Res ok = api.put(themePath, staffToken("ADMIN"), theme);
        assertEquals(200, ok.status(), ok.json().toString());
        assertEquals("#123456", jdbc.queryForObject("SELECT theme_primary FROM branches WHERE id=?", String.class, DL));

        // OTP reset.
        String victim = newBackoffice("STAFF", Q7);
        long victimId = userId(victim);
        String resetPath = "/api/v1/admin/users/" + victimId + "/otp/reset";
        assertEquals(403, api.post(resetPath, staffToken("STAFF", Q7), null).status());
        assertEquals(403, api.post(resetPath, staffToken("MANAGER", Q7), null).status());
        assertTrue(jdbc.queryForObject("SELECT totp_enabled FROM users WHERE id=?", Boolean.class, victimId));

        assertEquals(204, api.post(resetPath, staffToken("ADMIN"), null).status());
        assertFalse(jdbc.queryForObject("SELECT totp_enabled FROM users WHERE id=?", Boolean.class, victimId));
        assertNull(jdbc.queryForObject("SELECT totp_secret FROM users WHERE id=?", String.class, victimId));

        // The user must re-enroll: login says "not enrolled", enroll returns a fresh secret, a code from it logs in.
        Res login = api.post("/api/v1/auth/login", null, Api.map("identifier", victim, "password", PASSWORD));
        assertFalse(login.json().path("enrolled").asBoolean());
        String challenge = login.str("challengeToken");
        Res enroll = api.post("/api/v1/auth/otp/enroll", null, Api.map("challengeToken", challenge));
        assertEquals(200, enroll.status(), enroll.json().toString());
        String code = Totp.code(Totp.fromBase32(enroll.str("secret")), Totp.stepAt(Instant.now().getEpochSecond()));
        Res verified = api.post("/api/v1/auth/otp/verify", null, Api.map("challengeToken", challenge, "code", code));
        assertEquals(200, verified.status(), verified.json().toString());
        assertTrue(jdbc.queryForObject("SELECT totp_enabled FROM users WHERE id=?", Boolean.class, victimId));
    }

    @Test
    void onlyAdminCanAssignBranches() {
        String target = newBackoffice("STAFF", Q7);
        String path = "/api/v1/admin/users/" + userId(target) + "/branches";
        var body = Api.map("branchIds", java.util.List.of(Q3));
        assertEquals(403, api.put(path, staffToken("MANAGER", Q3), body).status());
        assertEquals(200, api.put(path, staffToken("ADMIN"), body).status());
        assertEquals(java.util.List.of(Q3), jdbc.queryForList("SELECT branch_id FROM user_branch_assignments WHERE user_id=?",
            Long.class, userId(target)));
    }
}
