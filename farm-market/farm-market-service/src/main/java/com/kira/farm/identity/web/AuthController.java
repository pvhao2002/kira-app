package com.kira.farm.identity.web;

import com.kira.farm.identity.application.AuthService;
import com.kira.farm.shared.security.AuthPrincipal;
import com.kira.farm.shared.security.CurrentUser;
import com.kira.farm.shared.infrastructure.ClientIpResolver;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;

import static com.kira.farm.identity.application.AuthDtos.*;

@Tag(name = "Auth")
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {
    private static final String COOKIE = "farm_refresh";
    private final AuthService auth;
    private final ClientIpResolver clientIps;
    @Value("${app.refresh-cookie-secure:false}")
    private boolean secureCookie;
    @Value("${app.refresh-cookie-same-site:Lax}")
    private String sameSite;
    @Value("${app.jwt.refresh-ttl}")
    private Duration refreshTtl;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest r) {
        return session(HttpStatus.CREATED, auth.register(r));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest r, HttpServletRequest request) {
        AuthService.LoginResult result = auth.login(r, clientIps.resolve(request), request.getHeader(HttpHeaders.USER_AGENT));
        if (result.challenge() != null) return ResponseEntity.ok(result.challenge());
        return session(HttpStatus.OK, result.session());
    }

    @PostMapping("/otp/enroll")
    public OtpEnrollResponse otpEnroll(@Valid @RequestBody OtpEnrollRequest r) {
        return auth.enrollOtp(r);
    }

    @PostMapping("/otp/verify")
    public ResponseEntity<AuthResponse> otpVerify(@Valid @RequestBody OtpVerifyRequest r) {
        return session(HttpStatus.OK, auth.verifyOtp(r));
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(@CookieValue(COOKIE) String token) {
        return session(HttpStatus.OK, auth.refresh(token));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@CookieValue(value = COOKIE, required = false) String token) {
        auth.logout(token);
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO).toString()).build();
    }

    @GetMapping("/me")
    public UserProfile me() {
        AuthPrincipal p = CurrentUser.require();
        return auth.me(p.userId());
    }

    @PutMapping("/me")
    public UserProfile updateMe(@Valid @RequestBody UpdateProfileRequest r) {
        return auth.updateProfile(CurrentUser.require().userId(), r);
    }

    private ResponseEntity<AuthResponse> session(HttpStatus status, AuthService.Session s) {
        return ResponseEntity.status(status).header(HttpHeaders.SET_COOKIE, cookie(s.refreshToken(), refreshTtl).toString())
            .body(s.response());
    }

    private ResponseCookie cookie(String value, Duration maxAge) {
        return ResponseCookie.from(COOKIE, value).httpOnly(true).secure(secureCookie).sameSite(sameSite)
            .path("/api/v1/auth").maxAge(maxAge).build();
    }
}
