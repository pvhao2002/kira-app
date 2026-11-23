package com.matchmind.security;

import com.matchmind.security.Principals.UserPrincipal;
import com.matchmind.shared.ApiErrors;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    /** What a user who must change the password first may still call. */
    private static final Set<String> ALLOWED_WHILE_PASSWORD_CHANGE_PENDING = Set.of("/api/v1/auth/me",
        "/api/v1/auth/change-password", "/api/v1/auth/logout", "/api/v1/auth/logout-all");
    private final JwtService jwt;
    private final UserRepository users;
    private final RevokedTokens revoked;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return request.getRequestURI().startsWith("/api/v1/external/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
        throws ServletException, IOException {
        String token = bearerOrMonitorCookie(req);
        if (token != null) {
            User user = null;
            try {
                JwtService.Parsed parsed = jwt.parse(token);
                user = users.findById(parsed.userId())
                    .filter(User::active)
                    .filter(u -> Objects.equals(u.getTokenVersion(), parsed.tokenVersion()))
                    .filter(u -> parsed.tokenId() == null || !revoked.isRevoked(parsed.tokenId()))
                    .orElse(null);
                if (user != null) {
                    SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                        new UserPrincipal(user.getId(), user.getUsername(), user.getRole(), parsed.tokenId(),
                            parsed.expiresAt(), parsed.sessionStartedAt()),
                        null, List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole()))));
                }
            } catch (RuntimeException ignored) {
                // Invalid/expired token: request stays unauthenticated. The token is never logged.
            }
            if (user != null && user.isMustChangePassword()
                && !ALLOWED_WHILE_PASSWORD_CHANGE_PENDING.contains(req.getRequestURI())) {
                SecurityContextHolder.clearContext();
                ApiErrors.write(req, res, 403, "PASSWORD_CHANGE_REQUIRED", "You must change your password before continuing");
                return;
            }
        }
        chain.doFilter(req, res);
    }

    /**
     * The Bearer header; on the monitor check only (nginx auth_request for /monitor), the {@code mm_monitor} cookie.
     * Every other path ignores cookies, so the API keeps no CSRF surface.
     */
    private static String bearerOrMonitorCookie(HttpServletRequest req) {
        String header = req.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) return header.substring(7);
        if (!MonitorController.CHECK_PATH.equals(req.getRequestURI()) || req.getCookies() == null) return null;
        return Arrays.stream(req.getCookies()).filter(c -> MonitorController.COOKIE.equals(c.getName()))
            .map(Cookie::getValue).findFirst().orElse(null);
    }
}
