package com.app.kira.config;


import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;
import java.util.Optional;


@Slf4j
@Component
@RequiredArgsConstructor(onConstructor_ = @Autowired)
@FieldDefaults(makeFinal = true, level = lombok.AccessLevel.PRIVATE)
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    JwtTokenProvider jwtUtilities;
    UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws
            ServletException,
            IOException {
        var token = jwtUtilities.getToken(request);
        if (org.apache.commons.lang3.StringUtils.isNotBlank(token)
                && !"null".equalsIgnoreCase(token)
                && jwtUtilities.validateToken(token)) {
            var username = jwtUtilities.extractUsername(token);

            var userDetails = userDetailsService.loadUserByUsername(username);
            if (jwtUtilities.validateToken(token, userDetails)) {
                var authToken = new UsernamePasswordAuthenticationToken(
                        userDetails,
                        null,
                        userDetails.getAuthorities()
                );
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder
                        .getContext()
                        .setAuthentication(authToken);
            }
        }
        filterChain.doFilter(request, response);
    }

    private Optional<String> getJwtFromRequest(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return Optional.of(bearerToken.replace("Bearer ", ""));
        }
        Cookie[] cookies = Optional
                .ofNullable(request.getCookies())
                .orElse(new Cookie[]{});
        return Arrays
                .stream(cookies)
                .filter(c -> "session".equalsIgnoreCase(c.getName()))
                .findFirst()
                .map(Cookie::getValue);
    }
}
