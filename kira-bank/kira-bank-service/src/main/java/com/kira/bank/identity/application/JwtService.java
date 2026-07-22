package com.kira.bank.identity.application;

import com.kira.bank.identity.domain.User;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.*;
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
        return Jwts.builder().subject(user.getId().toString()).claim("email", user.getEmail())
            .claim("roles", user.getRoles().stream().map(r -> r.getName()).toList())
            .issuedAt(Date.from(now)).expiration(Date.from(now.plus(accessTtl))).signWith(key).compact();
    }

    public Long subject(String token) {
        return Long.valueOf(Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload().getSubject());
    }

    public long expiresInSeconds() {
        return accessTtl.toSeconds();
    }
}

