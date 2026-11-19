package com.matchmind.security;

import com.matchmind.security.Principals.UserPrincipal;
import jakarta.servlet.FilterChain;
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
import java.util.List;
import java.util.Objects;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtService jwt;
    private final UserRepository users;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return request.getRequestURI().startsWith("/api/v1/external/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
        throws ServletException, IOException {
        String header = req.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            try {
                JwtService.Parsed parsed = jwt.parse(header.substring(7));
                users.findById(parsed.userId())
                    .filter(User::active)
                    .filter(u -> Objects.equals(u.getTokenVersion(), parsed.tokenVersion()))
                    .ifPresent(u -> SecurityContextHolder.getContext().setAuthentication(
                        new UsernamePasswordAuthenticationToken(new UserPrincipal(u.getId(), u.getUsername(), u.getRole()),
                            null, List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole())))));
            } catch (RuntimeException ignored) {
                // Invalid/expired token: request stays unauthenticated. The token is never logged.
            }
        }
        chain.doFilter(req, res);
    }
}
