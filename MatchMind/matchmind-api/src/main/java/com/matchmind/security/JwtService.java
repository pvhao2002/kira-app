package com.matchmind.security;

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
import java.util.UUID;

/** Short-lived HS256 access tokens. The "tv" claim must equal users.token_version or the token is dead. */
@Service
public class JwtService {
    private final SecretKey key;
    private final Duration ttl;

    public JwtService(@Value("${app.jwt.secret}") String secret, @Value("${app.jwt.ttl:PT8H}") Duration ttl) {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("app.jwt.secret (JWT_SECRET) must be at least 32 bytes");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.ttl = ttl;
    }

    public Issued issue(User user) {
        Instant now = Instant.now();
        Instant expires = now.plus(ttl);
        String token = Jwts.builder().subject(user.getId().toString()).claim("tv", user.getTokenVersion())
            .issuer("matchmind").issuedAt(Date.from(now)).expiration(Date.from(expires)).signWith(key).compact();
        return new Issued(token, expires);
    }

    public Parsed parse(String token) {
        Claims c = Jwts.parser().verifyWith(key).requireIssuer("matchmind").build().parseSignedClaims(token).getPayload();
        return new Parsed(UUID.fromString(c.getSubject()), c.get("tv", Integer.class));
    }

    public record Issued(String token, Instant expiresAt) {
    }

    public record Parsed(UUID userId, Integer tokenVersion) {
    }
}
