package com.matchmind.security;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {
    private final JwtService jwt = new JwtService("test-secret-test-secret-test-secret-0123456789",
        Duration.ofHours(8), Duration.ofHours(24));

    private static User user() {
        User u = new User();
        u.setId(UUID.randomUUID());
        u.setUsername("bob");
        return u;
    }

    @Test
    void freshTokenLivesTtlAndCarriesAnIdAndTheSessionStart() {
        Instant before = Instant.now();
        JwtService.Parsed p = jwt.parse(jwt.issue(user()).token());
        assertThat(p.tokenId()).isNotNull();
        assertThat(p.expiresAt()).isBetween(before.plus(Duration.ofHours(8)).minusSeconds(2), Instant.now().plus(Duration.ofHours(8)));
        assertThat(p.sessionStartedAt()).isBetween(before.minusSeconds(2), Instant.now());
    }

    @Test
    void refreshedTokensKeepTheSessionStartAndNeverOutliveTheMaximumSession() {
        Instant started = Instant.now().minus(Duration.ofHours(20));
        JwtService.Issued refreshed = jwt.issue(user(), started);
        JwtService.Parsed p = jwt.parse(refreshed.token());
        assertThat(p.sessionStartedAt().getEpochSecond()).isEqualTo(started.getEpochSecond());
        // 20 h into a 24 h cap: 4 h left, not another 8 h.
        assertThat(refreshed.expiresAt()).isBefore(started.plus(Duration.ofHours(24)).plusSeconds(2));
        assertThat(refreshed.expiresAt()).isBefore(Instant.now().plus(Duration.ofHours(4)).plusSeconds(2));
        assertThat(jwt.issue(user(), Instant.now().minus(Duration.ofHours(1))).expiresAt())
            .isAfter(Instant.now().plus(Duration.ofHours(7)));
    }

    @Test
    void tokenIssuedBeforeIdsExistedStillParses() {
        // Same key, no jti/oat claims: how tokens from the previous release look.
        String legacy = io.jsonwebtoken.Jwts.builder().subject(UUID.randomUUID().toString()).claim("tv", 3).issuer("matchmind")
            .issuedAt(java.util.Date.from(Instant.now())).expiration(java.util.Date.from(Instant.now().plusSeconds(600)))
            .signWith(io.jsonwebtoken.security.Keys.hmacShaKeyFor("test-secret-test-secret-test-secret-0123456789".getBytes()))
            .compact();
        JwtService.Parsed p = jwt.parse(legacy);
        assertThat(p.tokenId()).isNull();
        assertThat(p.tokenVersion()).isEqualTo(3);
        assertThat(p.sessionStartedAt()).isNotNull();
    }
}
