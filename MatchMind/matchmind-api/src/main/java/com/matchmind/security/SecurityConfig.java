package com.matchmind.security;

import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;

/**
 * Stateless security. Humans use a Bearer JWT (no cookies, so no CSRF surface); AI integrations use X-Api-Key on
 * /api/v1/external/** only. VIEWER may read, ADMIN may change; PROVIDER may only call the external callbacks.
 */
@Configuration
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {
    private final JwtAuthenticationFilter jwtFilter;
    private final ApiKeyAuthenticationFilter apiKeyFilter;

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    SecurityFilterChain security(HttpSecurity http) throws Exception {
        return http.csrf(c -> c.disable())
            .cors(c -> {
            })
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .headers(h -> h.frameOptions(f -> f.deny())
                .contentSecurityPolicy(c -> c.policyDirectives("default-src 'self'; frame-ancestors 'none'; object-src 'none'")))
            .exceptionHandling(e -> e
                .authenticationEntryPoint((rq, rs, ex) -> write(rs, 401, "UNAUTHORIZED", "Authentication required"))
                .accessDeniedHandler((rq, rs, ex) -> write(rs, 403, "FORBIDDEN", "You are not allowed to perform this action")))
            .authorizeHttpRequests(a -> a
                .requestMatchers("/actuator/health/**", "/actuator/health", "/swagger-ui/**", "/swagger-ui.html",
                    "/v3/api-docs/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/v1/auth/login").permitAll()
                .requestMatchers("/api/v1/external/**").hasRole("PROVIDER")
                .requestMatchers("/api/v1/auth/**").hasAnyRole("ADMIN", "VIEWER")
                .requestMatchers("/api/v1/users", "/api/v1/users/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/v1/**").hasAnyRole("ADMIN", "VIEWER")
                .requestMatchers("/api/v1/**").hasRole("ADMIN")
                .anyRequest().denyAll())
            .addFilterBefore(apiKeyFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
    }

    // The filters run inside the security chain only; stop Spring Boot from also registering them globally.
    @Bean
    FilterRegistrationBean<JwtAuthenticationFilter> jwtFilterRegistration(JwtAuthenticationFilter f) {
        FilterRegistrationBean<JwtAuthenticationFilter> r = new FilterRegistrationBean<>(f);
        r.setEnabled(false);
        return r;
    }

    @Bean
    FilterRegistrationBean<ApiKeyAuthenticationFilter> apiKeyFilterRegistration(ApiKeyAuthenticationFilter f) {
        FilterRegistrationBean<ApiKeyAuthenticationFilter> r = new FilterRegistrationBean<>(f);
        r.setEnabled(false);
        return r;
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(@Value("${app.cors-allowed-origins:}") String origins) {
        CorsConfiguration c = new CorsConfiguration();
        List<String> list = Arrays.stream(origins.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
        if (list.stream().anyMatch(o -> o.contains("*"))) {
            throw new IllegalStateException("CORS_ALLOWED_ORIGINS must list exact origins, wildcards are not allowed");
        }
        c.setAllowedOrigins(list);
        c.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        c.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Correlation-ID"));
        c.setExposedHeaders(List.of("X-Correlation-ID", "Retry-After", "Content-Disposition"));
        c.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        // External callbacks are server-to-server: no browser CORS for them.
        source.registerCorsConfiguration("/api/v1/**", c);
        return source;
    }

    private static void write(HttpServletResponse res, int status, String code, String message) throws IOException {
        res.setStatus(status);
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        res.getWriter().write("{\"status\":" + status + ",\"code\":\"" + code + "\",\"message\":\"" + message + "\"}");
    }
}
