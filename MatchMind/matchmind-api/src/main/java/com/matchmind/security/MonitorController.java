package com.matchmind.security;

import com.matchmind.security.Principals.UserPrincipal;
import com.matchmind.shared.ApiException;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Sign-in for the admin-only pages outside the SPA: /monitor (Grafana) and /swagger (API docs). The SPA keeps its JWT
 * out of cookies, but a new browser tab can only carry a cookie: {@code monitor-session} copies the caller's token into
 * HttpOnly cookies scoped to those two paths, and nginx asks {@code monitor-check} (auth_request) on every request
 * there, then hands the username to Grafana's auth proxy. The cookie is the same session: logout, logout-all, a password change or a disabled user end it too.
 * Both paths, and the Google Sheet link, are ADMIN only in {@link SecurityConfig}.
 */
@RestController
@Tag(name = "Authentication & users")
public class MonitorController {
    static final String CHECK_PATH = "/api/v1/auth/monitor-check";
    static final String SHEET_PATH = "/api/v1/auth/sheet";
    static final String COOKIE = "mm_monitor";
    @Value("${app.matchmind-sheet-url:}")
    private String sheetUrl;
    private static final List<String> PATHS = List.of("/monitor", "/swagger");

    @PostMapping("/api/v1/auth/monitor-session")
    public ResponseEntity<Void> session(@AuthenticationPrincipal UserPrincipal me, HttpServletRequest request) {
        String token = request.getHeader(HttpHeaders.AUTHORIZATION).substring("Bearer ".length());
        Duration maxAge = Duration.between(Instant.now(), me.tokenExpiresAt());
        String[] cookies = PATHS.stream().map(p -> ResponseCookie.from(COOKIE, token).path(p).httpOnly(true).secure(true)
            .sameSite("Strict").maxAge(maxAge).build().toString()).toArray(String[]::new);
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookies).build();
    }

    /** Admin menu link to the shared Google Sheet; 404 when MATCHMIND_SHEET_URL is unset or not https. */
    public record SheetLink(String url) {}

    @GetMapping(SHEET_PATH)
    public SheetLink sheet() {
        if (!sheetUrl.startsWith("https://")) {
            throw ApiException.notFound("SHEET_NOT_CONFIGURED", "Set MATCHMIND_SHEET_URL to link the Google Sheet.");
        }
        return new SheetLink(sheetUrl);
    }

    @GetMapping(CHECK_PATH)
    public ResponseEntity<Void> check(@AuthenticationPrincipal UserPrincipal me) {
        return ResponseEntity.noContent().header("X-Monitor-User", me.username()).build();
    }
}
