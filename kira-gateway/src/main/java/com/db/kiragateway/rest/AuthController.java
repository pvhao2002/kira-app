package com.db.kiragateway.rest;

import com.db.kiragateway.auth.dto.LoginRequest;
import com.db.kiragateway.auth.model.AuthenticatedUser;
import com.db.kiragateway.auth.service.AuthService;
import com.db.kiragateway.auth.service.JwtTokenService;
import com.db.kiragateway.config.security.AppSecurityProperties;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.logging.Logger;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private static final Logger log = Logger.getLogger(AuthController.class.getName());

    private final AuthService authService;
    private final JwtTokenService jwtTokenService;
    private final AppSecurityProperties props;

    public AuthController(AuthService authService,
                          JwtTokenService jwtTokenService,
                          AppSecurityProperties props) {
        this.authService = authService;
        this.jwtTokenService = jwtTokenService;
        this.props = props;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        var authenticated = authService.authenticate(request.username(), request.password());
        if (authenticated.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of(
                    "status", "error",
                    "message", "Invalid credentials"
            ));
        }

        var user = authenticated.get();
        var token = jwtTokenService.generateAccessToken(user);
        log.info("login successful for username=%s".formatted(user.username()));

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, buildAccessCookie(token).toString())
                .body(Map.of(
                        "status", "ok",
                        "data", buildUserData(user.userId(), user.username(), user.role(), user.avatar())
                ));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout() {
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, clearAccessCookie().toString())
                .body(Map.of("status", "ok"));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof Jwt jwt)) {
            return ResponseEntity.status(401).body(Map.of("status", "error", "message", "Unauthorized"));
        }

        var role = jwt.getClaimAsString("role");
        var uidClaim = jwt.getClaim("uid");
        var userId = uidClaim instanceof Number number ? number.intValue() : null;
        var username = jwt.getSubject();
        var profile = userId != null && userId > 0
                ? authService.findByUserId(userId)
                : authService.findByUsername(username);

        var responseUser = profile.orElseGet(() -> new AuthenticatedUser(
                userId == null ? 0 : userId,
                username,
                role == null ? "user" : role,
                null
        ));

        return ResponseEntity.ok(Map.of(
                "status", "ok",
                "data", buildUserData(
                        responseUser.userId(),
                        responseUser.username(),
                        responseUser.role(),
                        responseUser.avatar()
                )
        ));
    }

    private Map<String, Object> buildUserData(int userId, String username, String role, String avatar) {
        var data = new HashMap<String, Object>();
        data.put("userId", userId);
        data.put("username", username);
        data.put("role", role);
        data.put("avatar", avatar);
        return data;
    }

    private ResponseCookie buildAccessCookie(String token) {
        var cookieBuilder = ResponseCookie.from(props.getCookie().getName(), token)
                .httpOnly(true)
                .secure(props.getCookie().isSecure())
                .sameSite(props.getCookie().getSameSite())
                .path(props.getCookie().getPath())
                .maxAge(Duration.ofSeconds(props.getCookie().getMaxAgeSeconds()));

        if (StringUtils.hasText(props.getCookie().getDomain())) {
            cookieBuilder.domain(props.getCookie().getDomain());
        }
        return cookieBuilder.build();
    }

    private ResponseCookie clearAccessCookie() {
        var cookieBuilder = ResponseCookie.from(props.getCookie().getName(), "")
                .httpOnly(true)
                .secure(props.getCookie().isSecure())
                .sameSite(props.getCookie().getSameSite())
                .path(props.getCookie().getPath())
                .maxAge(Duration.ZERO);

        if (StringUtils.hasText(props.getCookie().getDomain())) {
            cookieBuilder.domain(props.getCookie().getDomain());
        }
        return cookieBuilder.build();
    }
}
