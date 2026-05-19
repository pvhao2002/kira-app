package com.app.kira.config;

import io.jsonwebtoken.*;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.security.Key;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.function.Function;


@Component
@Slf4j
public class JwtTokenProvider {

    @Value("${jwt.secret}")
    private String secret;

    //Thời gian có hiệu lực của chuỗi jwt

    @Value("${jwt.expiration}")
    private long jwtExpiration;

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public String extractPassword(String token) {
        return extractClaim(token, claims -> (String) claims.get("password"));
    }

    public List<String> extractRoles(String token) {
        return Collections.singletonList(extractClaim(token, claims -> claims
                .get("role")
                .toString()));
    }

    public Claims extractAllClaims(String token) {
        return Jwts
                .parserBuilder()
                .setSigningKey(getSignInKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    public Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    public boolean validateToken(String token, UserDetails userDetails) {
        final String username = extractUsername(token);
        return (username.equals(userDetails.getUsername())
                && !isTokenExpired(token));
    }

    public Boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    public String generateToken(String username, List<String> roles) {
        return Jwts
                .builder()
                .setSubject(username)
                .claim("role", roles)
                .setIssuedAt(new Date(System.currentTimeMillis()))
                .setExpiration(Date.from(Instant.now()
                        .plus(jwtExpiration, ChronoUnit.MILLIS)))
                .signWith(getSignInKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    public LoginResponse generateTokenV2(String username, List<String> roles) {
        var createdDate = Instant.now();
        var expiredDate = Instant.now().plus(jwtExpiration, ChronoUnit.MILLIS);
        var token = Jwts
                .builder()
                .setSubject(username)
                .claim("role", roles)
                .setIssuedAt(Date.from(createdDate))
                .setExpiration(Date.from(expiredDate))
                .signWith(getSignInKey(), SignatureAlgorithm.HS256)
                .compact();
        return LoginResponse
                .builder()
                .token(token)
                .email(username)
                .roles(roles)
                .expiredDate(expiredDate.toEpochMilli())
                .build();
    }

    public boolean validateToken(String token) {
        try {
            Jwts
                    .parserBuilder()
                    .setSigningKey(getSignInKey())
                    .build()
                    .parseClaimsJws(token);
            return true;
        } catch (SignatureException e) {
            log.info("Invalid JWT signature.");
            log.trace("Invalid JWT signature trace: {}", e.getMessage());
        } catch (MalformedJwtException e) {
            log.info("Invalid JWT token.");
            log.trace("Invalid JWT token trace: {}", e.getMessage());
        } catch (ExpiredJwtException e) {
            log.info("Expired JWT token.");
            log.trace("Expired JWT token trace: {}", e.getMessage());
        } catch (UnsupportedJwtException e) {
            log.info("Unsupported JWT token.");
            log.trace("Unsupported JWT token trace: {}", e.getMessage());
        } catch (IllegalArgumentException e) {
            log.info("JWT token compact of handler are invalid.");
            log.trace("JWT token compact of handler are invalid trace: {}", e.getMessage());
        }
        return false;
    }

    public String getToken(HttpServletRequest request) {
        final String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }

    private Key getSignInKey() {
        byte[] keyBytes = Decoders.BASE64.decode(secret);
        return Keys.hmacShaKeyFor(keyBytes);
    }
}
