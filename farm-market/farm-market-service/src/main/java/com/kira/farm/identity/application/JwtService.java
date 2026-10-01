package com.kira.farm.identity.application;

import com.kira.farm.identity.domain.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.List;

@Service
public class JwtService {
    private static final String PURPOSE = "purpose";
    private static final String OTP_CHALLENGE = "otp_challenge";
    private static final Duration CHALLENGE_TTL = Duration.ofMinutes(5);
    private final SecretKey key;
    private final Duration accessTtl;

    public JwtService(@Value("${app.jwt.secret}") String secret, @Value("${app.jwt.access-ttl}") Duration accessTtl) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessTtl = accessTtl;
    }

    /**
     * Claims carry role and branch assignment for clients; the server re-reads both from the database on every
     * request (see JwtAuthenticationFilter), so a stale token can never widen access.
     */
    public String issue(User user) {
        Instant now = Instant.now();
        List<Long> branches = user.getBranchIds().stream().sorted().toList();
        return Jwts.builder().subject(user.getId().toString())
            .claim("role", user.getRole().json())
            .claim("branches", branches)
            .issuedAt(Date.from(now)).expiration(Date.from(now.plus(accessTtl))).signWith(key).compact();
    }

    /** Verifies signature + expiry and returns the user id of an ACCESS token; OTP challenge tokens are rejected. */
    public Long subject(String token) {
        Claims c = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
        if (c.get(PURPOSE) != null) throw new IllegalArgumentException("Not an access token");
        return Long.valueOf(c.getSubject());
    }

    /** Short-lived token proving the password step succeeded; only usable at the /auth/otp endpoints. */
    public String issueChallenge(Long userId) {
        return issueChallenge(userId, CHALLENGE_TTL);
    }

    public String issueChallenge(Long userId, Duration ttl) {
        Instant now = Instant.now();
        return Jwts.builder().subject(userId.toString()).claim(PURPOSE, OTP_CHALLENGE)
            .issuedAt(Date.from(now)).expiration(Date.from(now.plus(ttl))).signWith(key).compact();
    }

    /** Returns the user id of a valid, unexpired challenge token; throws a RuntimeException otherwise. */
    public Long challengeSubject(String token) {
        Claims c = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
        if (!OTP_CHALLENGE.equals(c.get(PURPOSE))) throw new IllegalArgumentException("Not a challenge token");
        return Long.valueOf(c.getSubject());
    }

    public long expiresInSeconds() {
        return accessTtl.toSeconds();
    }
}
