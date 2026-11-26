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

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Optional;

/** Login and passwords: the two accounts are seeded by migration, there is no registration. */
@RestController
@RequestMapping("/api")
public class AuthController {
    // Compared against when the username is unknown, so both paths cost one bcrypt check.
    private static final String DUMMY_HASH = "$2y$10$dZ/whZTIG9AjCiZv5usOYuPjgt7yxjFD.iHrRi5VP7nuo5Oc4CVRu";
    private final JdbcClient jdbc;
    private final PasswordEncoder encoder;
    private final SessionTokens tokens;
    private final SessionVersions versions;
    private final LoginRateLimiter limiter;
    private final boolean secureCookie;

    public AuthController(JdbcClient jdbc, PasswordEncoder encoder, SessionTokens tokens, SessionVersions versions,
                          LoginRateLimiter limiter, @Value("${app.cookie-secure}") boolean secureCookie) {
        this.jdbc = jdbc;
        this.encoder = encoder;
        this.tokens = tokens;
        this.versions = versions;
        this.limiter = limiter;
        this.secureCookie = secureCookie;
    }

    public record LoginRequest(@NotBlank @Size(max = 50) String username, @NotBlank @Size(max = 100) String password) {
    }

    public record ChangePassword(@NotBlank @Size(max = 100) String currentPassword,
                                 @NotBlank @Size(min = 8, max = 100) String newPassword) {
    }

    public record ResetPassword(@NotBlank @Size(min = 8, max = 100) String newPassword) {
    }

    record Account(long id, String username, String passwordHash, String role, String displayName) {
    }

    @PostMapping("/auth/login")
    ResponseEntity<CurrentUser> login(@Valid @RequestBody LoginRequest req) {
        String username = req.username().trim().toLowerCase();
        if (limiter.blocked(username)) throw tooManyAttempts();
        Account a = account(username).orElse(null);
        boolean ok = encoder.matches(req.password(), a == null ? DUMMY_HASH : a.passwordHash()) && a != null;
        if (!ok) {
            // Only real accounts are tracked: unknown names cannot log in, and tracking them lets the map grow forever.
            if (a != null) limiter.failed(username);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "BAD_CREDENTIALS", "Sai tên đăng nhập hoặc mật khẩu");
        }
        limiter.succeeded(username);
        CurrentUser user = new CurrentUser(a.id(), a.username(), a.role(), a.displayName());
        return signedIn(user, versions.current(a.id()));
    }

    @PostMapping("/auth/logout")
    ResponseEntity<Void> logout() {
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO).toString()).build();
    }

    @GetMapping("/auth/me")
    CurrentUser me(@AuthenticationPrincipal CurrentUser user) {
        return user;
    }

    /** Every other session of the account ends; this one continues on the fresh cookie. */
    @PutMapping("/auth/password")
    ResponseEntity<CurrentUser> changePassword(@AuthenticationPrincipal CurrentUser user,
                                               @Valid @RequestBody ChangePassword req) {
        // Shares the login limit, so a stolen session cannot guess the password here instead.
        if (limiter.blocked(user.username())) throw tooManyAttempts();
        String hash = jdbc.sql("SELECT password_hash FROM users WHERE id = ?").param(user.id()).query(String.class).single();
        if (!encoder.matches(req.currentPassword(), hash)) {
            limiter.failed(user.username());
            throw ApiException.badRequest("WRONG_PASSWORD", "Mật khẩu hiện tại không đúng");
        }
        limiter.succeeded(user.username());
        if (encoder.matches(req.newPassword(), hash)) {
            throw ApiException.badRequest("SAME_PASSWORD", "Mật khẩu mới phải khác mật khẩu cũ");
        }
        return signedIn(user, versions.setPassword(user.id(), hash(req.newPassword())));
    }

    /** For the other account, e.g. a forgotten password; it is signed out everywhere. */
    @PutMapping("/admin/users/{username}/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void resetPassword(@AuthenticationPrincipal CurrentUser admin, @PathVariable String username,
                       @Valid @RequestBody ResetPassword req) {
        Account a = account(username).orElseThrow(ApiException::notFound);
        // By id: the column ignores case, so "ADMIN" finds the admin too. Your own change must prove the current password.
        if (a.id() == admin.id()) {
            throw ApiException.badRequest("USE_CHANGE_PASSWORD", "Đổi mật khẩu của chính bạn ở mục Đổi mật khẩu");
        }
        versions.setPassword(a.id(), hash(req.newPassword()));
    }

    private Optional<Account> account(String username) {
        return jdbc.sql("SELECT id, username, password_hash, role, display_name FROM users WHERE username = ?")
            .param(username).query(Account.class).optional();
    }

    /** bcrypt only reads 72 bytes, and Spring refuses longer input rather than cutting it. */
    private String hash(String password) {
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw ApiException.badRequest("VALIDATION_ERROR", "Mật khẩu mới quá dài");
        }
        return encoder.encode(password);
    }

    private ResponseEntity<CurrentUser> signedIn(CurrentUser user, int sessionVersion) {
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, cookie(tokens.issue(user, sessionVersion), tokens.ttl()).toString()).body(user);
    }

    private static ApiException tooManyAttempts() {
        return new ApiException(HttpStatus.TOO_MANY_REQUESTS, "TOO_MANY_ATTEMPTS",
            "Bạn nhập sai quá nhiều lần, hãy thử lại sau ít phút");
    }

    private ResponseCookie cookie(String value, Duration maxAge) {
        // SameSite=Strict keeps the cookie off cross-site requests, which is the CSRF defence for this API.
        return ResponseCookie.from(SessionTokens.COOKIE, value).httpOnly(true).secure(secureCookie).sameSite("Strict")
            .path("/").maxAge(maxAge).build();
    }
}
