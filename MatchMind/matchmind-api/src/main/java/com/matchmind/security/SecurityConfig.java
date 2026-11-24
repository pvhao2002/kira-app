package com.matchmind.security;

import com.matchmind.external.ExternalController;
import com.matchmind.external.ExternalPingController;
import jakarta.servlet.DispatcherType;
import com.matchmind.shared.ApiErrors;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

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
    private final AdminActionAuditFilter adminActionAuditFilter;

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
            // The API owns the security headers of /api/* (nginx adds only HSTS there); nginx owns them for the SPA.
            .headers(h -> h.frameOptions(f -> f.deny())
                .referrerPolicy(r -> r.policy(ReferrerPolicy.NO_REFERRER))
                .contentSecurityPolicy(c -> c.policyDirectives("default-src 'self'; frame-ancestors 'none'; object-src 'none'")))
            .exceptionHandling(e -> e
                .authenticationEntryPoint((rq, rs, ex) -> ApiErrors.write(rq, rs, 401, "UNAUTHORIZED", "Authentication required"))
                .accessDeniedHandler((rq, rs, ex) -> ApiErrors.write(rq, rs, 403, "FORBIDDEN",
                    "You are not allowed to perform this action")))
            .authorizeHttpRequests(a -> a
                // The end of an event stream re-enters the chain as an ASYNC dispatch of a request already authorized.
                .dispatcherTypeMatchers(DispatcherType.ASYNC).permitAll()
                // /swagger/** is reached only through nginx, which lets admins in (auth_request); the API port is localhost only.
                .requestMatchers("/actuator/health/**", "/actuator/health", "/swagger/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/v1/auth/login").permitAll()
                // Signed-out visitors log their visit from the login page; reading the log is ADMIN only.
                .requestMatchers(HttpMethod.POST, "/api/v1/visits").permitAll()
                .requestMatchers("/api/v1/visits", "/api/v1/visits/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, ExternalPingController.PATH).permitAll()
                .requestMatchers("/api/v1/external/**").hasRole("PROVIDER")
                .requestMatchers("/api/v1/auth/monitor-session", MonitorController.CHECK_PATH, MonitorController.SHEET_PATH).hasRole("ADMIN")
                .requestMatchers("/api/v1/auth/**").hasAnyRole("ADMIN", "VIEWER")
                .requestMatchers(HttpMethod.POST, "/api/v1/account/imports").hasAnyRole("ADMIN", "VIEWER")
                // Every signed-in user keeps their own parlays (the controller scopes each query to the caller).
                .requestMatchers("/api/v1/parlays", "/api/v1/parlays/**").hasAnyRole("ADMIN", "VIEWER")
                .requestMatchers("/api/v1/users", "/api/v1/users/**").hasRole("ADMIN")
                // Callback audit trail: client IPs, endpoints and error text are for admins only (the UI hides the menu).
                .requestMatchers("/api/v1/api-logs", "/api/v1/api-logs/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/v1/**").hasAnyRole("ADMIN", "VIEWER")
                .requestMatchers("/api/v1/**").hasRole("ADMIN")
                .anyRequest().denyAll())
            .addFilterBefore(apiKeyFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterAfter(adminActionAuditFilter, JwtAuthenticationFilter.class)
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
    FilterRegistrationBean<AdminActionAuditFilter> adminActionAuditFilterRegistration(AdminActionAuditFilter f) {
        FilterRegistrationBean<AdminActionAuditFilter> r = new FilterRegistrationBean<>(f);
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
        // Agents in sandboxes cannot reach the API, so the MatchMind artifact sends their requests from the user's
        // browser: any page may call the external callbacks. The key travels in a header, never a cookie, so a page
        // that does not hold it gains nothing.
        CorsConfiguration external = new CorsConfiguration();
        external.setAllowedOrigins(List.of("*"));
        external.setAllowedMethods(List.of("GET", "POST"));
        external.setAllowedHeaders(List.of("Content-Type", ApiKeyAuthenticationFilter.HEADER,
            ApiKeyAuthenticationFilter.PROVIDER_HEADER, ExternalController.MODEL_HEADER,
            ExternalController.MODEL_VERSION_HEADER, "X-Request-Id"));
        external.setExposedHeaders(List.of("X-Correlation-ID", "Retry-After"));
        external.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/v1/external/**", external); // the first registered match wins
        source.registerCorsConfiguration("/api/v1/**", c);
        return source;
    }
}
