package com.kira.farm.identity.infrastructure;

import com.kira.farm.identity.application.JwtService;
import com.kira.farm.identity.domain.UserStatus;
import com.kira.farm.shared.security.AuthPrincipal;
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
import java.util.Set;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtService jwt;
    private final UserRepository users;

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
        throws ServletException, IOException {
        String header = req.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ") && SecurityContextHolder.getContext().getAuthentication() == null) {
            try {
                Long id = jwt.subject(header.substring(7));
                users.findById(id).filter(u -> u.getStatus() == UserStatus.ACTIVE).ifPresent(u -> {
                    var principal = new AuthPrincipal(u.getId(), u.getRole(), Set.copyOf(u.getBranchIds()));
                    SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                        principal, null, List.of(new SimpleGrantedAuthority(u.getRole().authority()))));
                });
            } catch (RuntimeException ignored) {
                // Invalid/expired tokens are treated as unauthenticated; the token value is never logged.
            }
        }
        chain.doFilter(req, res);
    }
}
