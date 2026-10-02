package com.kira.farm.it;

import com.kira.farm.it.Api.Res;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class AdminUserManagementIT extends IntegrationTestBase {

    private Res create(String adminToken, String email, String role, List<Long> branches) {
        return api.post("/api/v1/admin/users", adminToken, Api.map("fullName", "Nhân viên mới", "email", email,
            "password", "Tam-thoi-123", "role", role, "branchIds", branches));
    }

    @Test
    void adminCreatesStaffWithBranchesAndDuplicateEmailIs409() {
        String admin = staffToken("ADMIN");
        String email = unique("newstaff") + "@test.vn";
        Res created = create(admin, email, "staff", List.of(Q7, Q3));
        assertEquals(201, created.status(), created.json().toString());
        assertEquals("staff", created.str("role"));
        assertEquals(2, created.json().path("branchIds").size());
        Res duplicate = create(admin, email.toUpperCase(), "staff", List.of(Q7)); // upper case: email is case-insensitive
        assertEquals(409, duplicate.status());
        assertEquals("EMAIL_EXISTS", duplicate.code());
        Res badBranch = create(admin, unique("nb") + "@test.vn", "staff", List.of(999_999L));
        assertEquals(400, badBranch.status());
        assertEquals("BRANCH_NOT_FOUND", badBranch.code());
        assertEquals(422, create(admin, unique("c") + "@test.vn", "customer", List.of()).status());
    }

    @Test
    void newUserMustEnrollOtpOnFirstLogin() {
        String admin = staffToken("ADMIN");
        String email = unique("fresh") + "@test.vn";
        assertEquals(201, create(admin, email, "manager", List.of(Q7)).status());
        Res login = api.post("/api/v1/auth/login", null, Api.map("identifier", email, "password", "Tam-thoi-123"));
        assertEquals(200, login.status());
        assertTrue(login.json().path("otpRequired").asBoolean());
        assertFalse(login.json().path("enrolled").asBoolean());
    }

    @Test
    void changeRoleDropsBranchesRevokesTokensAndAdminCannotChangeSelf() {
        String adminEmail = newBackoffice("ADMIN");
        String admin = login(adminEmail);
        String staffEmail = newBackoffice("STAFF", Q7);
        long staffId = userId(staffEmail);
        Res verify = api.post("/api/v1/auth/otp/verify", null,
            Api.map("challengeToken", challenge(staffEmail), "code", currentCode()));
        assertEquals(200, verify.status());
        assertTrue(jdbc.queryForObject(
            "SELECT COUNT(*) FROM refresh_tokens WHERE user_id=? AND revoked_at IS NULL", Integer.class, staffId) > 0);

        Res changed = api.put("/api/v1/admin/users/" + staffId + "/role", admin, Api.map("role", "admin"));
        assertEquals(200, changed.status(), changed.json().toString());
        assertEquals("admin", changed.str("role"));
        assertEquals(0, changed.json().path("branchIds").size());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM user_branch_assignments WHERE user_id=?", Integer.class, staffId));
        assertEquals(0, jdbc.queryForObject(
            "SELECT COUNT(*) FROM refresh_tokens WHERE user_id=? AND revoked_at IS NULL", Integer.class, staffId));

        Res self = api.put("/api/v1/admin/users/" + userId(adminEmail) + "/role", admin, Api.map("role", "staff"));
        assertEquals(422, self.status());
        assertEquals("CANNOT_CHANGE_OWN_ROLE", self.code());
        assertEquals(422, api.put("/api/v1/admin/users/" + staffId + "/role", admin, Api.map("role", "customer")).status());
    }

    @Test
    void changeRoleRejectsUnknownAndCustomerTargetsAndAllowsDemotingAnotherAdmin() {
        String admin = staffToken("ADMIN");
        assertEquals(404, api.put("/api/v1/admin/users/999999999/role", admin, Api.map("role", "staff")).status());

        Res customer = api.put("/api/v1/admin/users/" + newCustomer().id() + "/role", admin, Api.map("role", "staff"));
        assertEquals(422, customer.status());
        assertEquals("USER_NOT_BACKOFFICE", customer.code());

        // LAST_ADMIN needs an isolated DB (the shared container always holds other admins): not covered here.
        long otherAdmin = userId(newBackoffice("ADMIN"));
        Res demoted = api.put("/api/v1/admin/users/" + otherAdmin + "/role", admin, Api.map("role", "staff"));
        assertEquals(200, demoted.status(), demoted.json().toString());
        assertEquals("staff", demoted.str("role"));
    }

    @Test
    void staffAndManagerCannotManageUsers() {
        for (String role : new String[]{"STAFF", "MANAGER"}) {
            String token = staffToken(role, Q7);
            assertEquals(403, create(token, unique("x") + "@test.vn", "staff", List.of(Q7)).status());
            assertEquals(403, api.put("/api/v1/admin/users/1/role", token, Api.map("role", "staff")).status());
        }
    }
}
