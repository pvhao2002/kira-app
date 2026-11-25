package com.kira.memory.identity;

import com.kira.memory.shared.ApiException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;

/** Login only: the two accounts are seeded by migration, there is no registration. */
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    // Compared against when the username is unknown, so both paths cost one bcrypt check.
    private static final String DUMMY_HASH = "$2y$10$dZ/whZTIG9AjCiZv5usOYuPjgt7yxjFD.iHrRi5VP7nuo5Oc4CVRu";
    private final JdbcClient jdbc;
    private final PasswordEncoder encoder;
    private final SessionTokens tokens;
    private final LoginRateLimiter limiter;
    private final boolean secureCookie;

    public AuthController(JdbcClient jdbc, PasswordEncoder encoder, SessionTokens tokens, LoginRateLimiter limiter,
                          @Value("${app.cookie-secure}") boolean secureCookie) {
        this.jdbc = jdbc;
        this.encoder = encoder;
        this.tokens = tokens;
        this.limiter = limiter;
        this.secureCookie = secureCookie;
    }

    public record LoginRequest(@NotBlank @Size(max = 50) String username, @NotBlank @Size(max = 100) String password) {
    }

    record Account(long id, String username, String passwordHash, String role, String displayName) {
    }

    @PostMapping("/login")
    ResponseEntity<CurrentUser> login(@Valid @RequestBody LoginRequest req) {
        String username = req.username().trim().toLowerCase();
        if (limiter.blocked(username)) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "TOO_MANY_ATTEMPTS",
                "Bạn nhập sai quá nhiều lần, hãy thử lại sau ít phút");
        }
        Account a = jdbc.sql("SELECT id, username, password_hash, role, display_name FROM users WHERE username = ?")
            .param(username).query(Account.class).optional().orElse(null);
        boolean ok = encoder.matches(req.password(), a == null ? DUMMY_HASH : a.passwordHash()) && a != null;
        if (!ok) {
            // Only real accounts are tracked: unknown names cannot log in, and tracking them lets the map grow forever.
            if (a != null) limiter.failed(username);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "BAD_CREDENTIALS", "Sai tên đăng nhập hoặc mật khẩu");
        }
        limiter.succeeded(username);
        CurrentUser user = new CurrentUser(a.id(), a.username(), a.role(), a.displayName());
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookie(tokens.issue(user), tokens.ttl()).toString())
            .body(user);
    }

    @PostMapping("/logout")
    ResponseEntity<Void> logout() {
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO).toString()).build();
    }

    @GetMapping("/me")
    CurrentUser me(@AuthenticationPrincipal CurrentUser user) {
        return user;
    }

    private ResponseCookie cookie(String value, Duration maxAge) {
        // SameSite=Strict keeps the cookie off cross-site requests, which is the CSRF defence for this API.
        return ResponseCookie.from(SessionTokens.COOKIE, value).httpOnly(true).secure(secureCookie).sameSite("Strict")
            .path("/").maxAge(maxAge).build();
    }
}
