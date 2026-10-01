package com.kira.farm.identity;

import com.kira.farm.identity.application.JwtService;
import com.kira.farm.identity.domain.Role;
import com.kira.farm.identity.domain.User;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.Base64;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTest {
    static final String SECRET = "unit-test-secret-unit-test-secret-unit-test-secret-0123456789";
    JwtService jwt = new JwtService(SECRET, Duration.ofMinutes(15));

    User user() {
        User u = new User();
        u.setId(42L);
        u.setRole(Role.STAFF);
        u.setBranchIds(Set.of(2L, 1L));
        return u;
    }

    @Test
    void issueThenParseReturnsUserId() {
        assertEquals(42L, jwt.subject(jwt.issue(user())));
        assertEquals(900, jwt.expiresInSeconds());
    }

    @Test
    void tamperedForeignExpiredAndGarbageTokensAreRejected() {
        String token = jwt.issue(user());
        String[] parts = token.split("\\.");
        String forged = parts[0] + "." + Base64.getUrlEncoder().withoutPadding()
            .encodeToString("{\"sub\":\"1\",\"role\":\"admin\"}".getBytes()) + "." + parts[2];
        assertThrows(RuntimeException.class, () -> jwt.subject(forged));
        JwtService other = new JwtService(SECRET.replace('u', 'x'), Duration.ofMinutes(15));
        assertThrows(RuntimeException.class, () -> other.subject(token));
        JwtService expired = new JwtService(SECRET, Duration.ofSeconds(-5));
        assertThrows(RuntimeException.class, () -> expired.subject(expired.issue(user())));
        assertThrows(RuntimeException.class, () -> jwt.subject("not-a-jwt"));
    }
}
