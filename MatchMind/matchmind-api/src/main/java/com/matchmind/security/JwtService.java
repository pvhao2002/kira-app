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

/**
 * HS256 access tokens. The "tv" claim must equal users.token_version or the token is dead; "jti" lets one session be
 * revoked; "oat" is when the password sign-in happened and caps the whole chain of refreshed tokens (max-session).
 */
@Service
public class JwtService {
    private final SecretKey key;
    private final Duration ttl;
    private final Duration maxSession;

    public JwtService(@Value("${app.jwt.secret}") String secret, @Value("${app.jwt.ttl:PT8H}") Duration ttl,
                      @Value("${app.jwt.max-session:PT24H}") Duration maxSession) {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("app.jwt.secret (JWT_SECRET) must be at least 32 bytes");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.ttl = ttl;
        this.maxSession = maxSession.compareTo(ttl) < 0 ? ttl : maxSession;
    }

    /** A token for a fresh password sign-in. */
    public Issued issue(User user) {
        return issue(user, Instant.now());
    }

    /** A token that belongs to the sign-in made at {@code sessionStart}; expires at most {@code max-session} after it. */
    public Issued issue(User user, Instant sessionStart) {
        Instant now = Instant.now();
        Instant expires = now.plus(ttl);
        Instant hardLimit = sessionStart.plus(maxSession);
        if (expires.isAfter(hardLimit)) expires = hardLimit;
        String token = Jwts.builder().subject(user.getId().toString()).id(UUID.randomUUID().toString())
            .claim("tv", user.getTokenVersion()).claim("oat", sessionStart.getEpochSecond())
            .issuer("matchmind").issuedAt(Date.from(now)).expiration(Date.from(expires)).signWith(key).compact();
        return new Issued(token, expires);
    }

    public Parsed parse(String token) {
        Claims c = Jwts.parser().verifyWith(key).requireIssuer("matchmind").build().parseSignedClaims(token).getPayload();
        String id = c.getId();
        Long oat = c.get("oat", Long.class);
        Instant issuedAt = c.getIssuedAt().toInstant();
        return new Parsed(UUID.fromString(c.getSubject()), c.get("tv", Integer.class), id == null ? null : UUID.fromString(id),
            c.getExpiration().toInstant(), oat == null ? issuedAt : Instant.ofEpochSecond(oat));
    }

    public record Issued(String token, Instant expiresAt) {
    }

    /** {@code tokenId} is null for tokens issued before sessions could be revoked individually. */
    public record Parsed(UUID userId, Integer tokenVersion, UUID tokenId, Instant expiresAt, Instant sessionStartedAt) {
    }
}
