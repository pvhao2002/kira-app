package com.kira.affiliate.identity.application;

import com.kira.affiliate.identity.domain.User;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;

@Service
public class JwtService {
    private final SecretKey key;
    private final Duration accessTtl;

    public JwtService(@Value("${app.jwt.secret}") String secret, @Value("${app.jwt.access-ttl}") Duration accessTtl) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessTtl = accessTtl;
    }

    public String issue(User user) {
        Instant now = Instant.now();
        return Jwts.builder().subject(user.getId().toString())
            .issuedAt(Date.from(now)).expiration(Date.from(now.plus(accessTtl))).signWith(key).compact();
    }

    public Long subject(String token) {
        return Long.valueOf(Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload().getSubject());
    }

    public long expiresInSeconds() {
        return accessTtl.toSeconds();
    }
}

