package com.matchmind.security;

import com.matchmind.external.ExternalAuditService;
import com.matchmind.security.Principals.UserPrincipal;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;

/**
 * Settle, recalculate and override from the dashboard leave an API-log row naming the signed-in user (no body, no
 * secrets), like the import does, so a manual change can be traced to a person.
 */
@Component
@RequiredArgsConstructor
public class AdminActionAuditFilter extends OncePerRequestFilter {
    private final ExternalAuditService audit;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !"POST".equals(request.getMethod()) || !request.getRequestURI().startsWith("/api/v1/settlements/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
        throws ServletException, IOException {
        Instant received = Instant.now();
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean signedIn = auth != null && auth.getPrincipal() instanceof UserPrincipal;
        try {
            chain.doFilter(req, res);
        } finally {
            if (signedIn) {
                int status = res.getStatus();
                audit.record(req, received, new ExternalAuditService.Entry(null, null, status,
                    status < 400 ? "SUCCESS" : status < 500 ? "REJECTED" : "FAILED", null, null));
            }
        }
    }
}
