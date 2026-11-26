package com.kira.memory.identity;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class SessionCookieFilter extends OncePerRequestFilter {
    private final SessionTokens tokens;
    private final SessionVersions versions;

    public SessionCookieFilter(SessionTokens tokens, SessionVersions versions) {
        this.tokens = tokens;
        this.versions = versions;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie c : cookies) {
                if (!SessionTokens.COOKIE.equals(c.getName())) continue;
                tokens.read(c.getValue())
                    // A password change moves the account to a new version, which ends every older session.
                    .filter(s -> s.version() == versions.current(s.user().id()))
                    .ifPresent(s -> SecurityContextHolder.getContext().setAuthentication(
                        new UsernamePasswordAuthenticationToken(s.user(), null,
                            List.of(new SimpleGrantedAuthority("ROLE_" + s.user().role())))));
            }
        }
        chain.doFilter(request, response);
    }
}
