package com.kira.memory.identity;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;

/** Signs and reads the session JWT kept in the HttpOnly cookie. */
@Component
public class SessionTokens {
    public static final String COOKIE = "km_session";
    private final SecretKey key;
    private final Duration ttl;

    public SessionTokens(@Value("${app.jwt.secret}") String secret, @Value("${app.jwt.ttl}") Duration ttl) {
        if (secret == null || secret.length() < 32) throw new IllegalStateException("JWT_SECRET must be at least 32 chars");
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.ttl = ttl;
    }

    /** A correctly signed, unexpired token: the account and the session version it was issued under. */
    public record Session(CurrentUser user, int version) {
    }

    public Duration ttl() {
        return ttl;
    }

    public String issue(CurrentUser user, int sessionVersion) {
        Instant now = Instant.now();
        return Jwts.builder().subject(String.valueOf(user.id())).claim("u", user.username()).claim("r", user.role())
            .claim("n", user.displayName()).claim("sv", sessionVersion).issuedAt(Date.from(now))
            .expiration(Date.from(now.plus(ttl))).signWith(key).compact();
    }

    public Optional<Session> read(String token) {
        try {
            Claims c = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            Integer sv = c.get("sv", Integer.class);
            // Tokens issued before session versions existed carry none: they count as version 0.
            return Optional.of(new Session(new CurrentUser(Long.parseLong(c.getSubject()), c.get("u", String.class),
                c.get("r", String.class), c.get("n", String.class)), sv == null ? 0 : sv));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
