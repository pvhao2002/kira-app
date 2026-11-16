package com.kira.affiliate.identity.web;

import com.kira.affiliate.identity.application.AuthService;
import com.kira.affiliate.shared.infrastructure.ClientIpResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;

import static com.kira.affiliate.identity.application.AuthDtos.*;

@RestController
@RequiredArgsConstructor
public class AuthController {
    private static final String COOKIE = "kaff_refresh";
    private final AuthService auth;
    private final ClientIpResolver clientIps;
    @Value("${app.refresh-cookie-secure:false}")
    private boolean secureCookie;

    @PostMapping("/api/v1/auth/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest r, HttpServletRequest request) {
        return session(auth.login(r, clientIps.resolve(request).ip()));
    }

    @PostMapping("/api/v1/auth/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest r, HttpServletRequest request) {
        return session(auth.register(r, clientIps.resolve(request).ip()));
    }

    @PostMapping("/api/v1/auth/refresh")
    public ResponseEntity<AuthResponse> refresh(@CookieValue(COOKIE) String token) {
        return session(auth.rotate(token));
    }

    @PostMapping("/api/v1/auth/logout")
    public ResponseEntity<Void> logout(@CookieValue(value = COOKIE, required = false) String token) {
        auth.logout(token);
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, clearCookie().toString()).build();
    }

    @GetMapping("/api/v1/auth/profile")
    public ProfileResponse profile(@AuthenticationPrincipal Long id) {
        return auth.profile(id);
    }

    @PutMapping("/api/v1/auth/profile")
    public ProfileResponse update(@AuthenticationPrincipal Long id, @Valid @RequestBody UpdateProfileRequest r) {
        return auth.update(id, r);
    }

    @PostMapping("/api/v1/auth/change-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void change(@AuthenticationPrincipal Long id, @Valid @RequestBody ChangePasswordRequest r) {
        auth.changePassword(id, r);
    }

    private ResponseEntity<AuthResponse> session(AuthService.Session s) {
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookie(s.refreshToken()).toString()).body(s.response());
    }

    private ResponseCookie cookie(String value) {
        return ResponseCookie.from(COOKIE, value).httpOnly(true).secure(secureCookie).sameSite("Strict").path("/api/v1/auth").maxAge(Duration.ofDays(30)).build();
    }

    private ResponseCookie clearCookie() {
        return ResponseCookie.from(COOKIE, "").httpOnly(true).secure(secureCookie).sameSite("Strict").path("/api/v1/auth").maxAge(Duration.ZERO).build();
    }
}
