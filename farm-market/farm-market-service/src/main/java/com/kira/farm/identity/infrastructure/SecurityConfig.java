package com.kira.farm.identity.infrastructure;

import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.io.IOException;
import java.net.URI;
import java.util.Arrays;
import java.util.List;

@Configuration
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {
    private final JwtAuthenticationFilter jwt;

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    SecurityFilterChain security(HttpSecurity http) throws Exception {
        return http.csrf(c -> c.disable()).cors(Customizer.withDefaults())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .headers(h -> h
                .contentSecurityPolicy(c -> c.policyDirectives(
                    "default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'"))
                .frameOptions(f -> f.deny())
                .contentTypeOptions(Customizer.withDefaults())
                .httpStrictTransportSecurity(hsts -> hsts.includeSubDomains(false).maxAgeInSeconds(31_536_000))
                .referrerPolicy(r -> r.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN)))
            .exceptionHandling(e -> e
                .authenticationEntryPoint((request, response, failure) ->
                    writeError(response, HttpStatus.UNAUTHORIZED, "UNAUTHORIZED"))
                .accessDeniedHandler((request, response, failure) ->
                    writeError(response, HttpStatus.FORBIDDEN, "FORBIDDEN")))
            .authorizeHttpRequests(a -> a
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers("/actuator/health", "/actuator/health/**", "/swagger-ui/**", "/swagger-ui.html",
                    "/v3/api-docs/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/v1/auth/register", "/api/v1/auth/login",
                    "/api/v1/auth/refresh", "/api/v1/auth/logout", "/api/v1/auth/otp/enroll",
                    "/api/v1/auth/otp/verify").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/branches", "/api/v1/categories",
                    "/api/v1/products", "/api/v1/products/**").permitAll()
                // Staff and managers see only their assigned branches (enforced by BranchAccess); admin sees all.
                .requestMatchers("/api/v1/admin/**").hasAnyRole("STAFF", "MANAGER", "ADMIN")
                .anyRequest().authenticated())
            .addFilterBefore(jwt, UsernamePasswordAuthenticationFilter.class).build();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(@Value("${app.cors-allowed-origins}") String origins) {
        CorsConfiguration c = new CorsConfiguration();
        c.setAllowedOrigins(allowedOrigins(origins));
        c.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        c.setAllowedHeaders(List.of("Authorization", "Content-Type", "Idempotency-Key", "X-Correlation-ID"));
        c.setExposedHeaders(List.of("X-Correlation-ID", "Retry-After"));
        c.setAllowCredentials(true);
        c.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", c);
        return source;
    }

    /** Accepts only exact scheme://host[:port] origins; wildcards and paths fail at startup. */
    static List<String> allowedOrigins(String configured) {
        List<String> origins = Arrays.stream(configured == null ? new String[0] : configured.split(","))
            .map(String::trim).map(v -> v.endsWith("/") ? v.substring(0, v.length() - 1) : v)
            .filter(v -> !v.isEmpty()).distinct().toList();
        for (String origin : origins) {
            URI uri;
            try {
                uri = URI.create(origin);
            } catch (IllegalArgumentException ex) {
                throw new IllegalStateException("Invalid CORS_ALLOWED_ORIGINS entry");
            }
            boolean http = "http".equals(uri.getScheme()) || "https".equals(uri.getScheme());
            if (origin.contains("*") || !http || uri.getHost() == null || uri.getRawUserInfo() != null
                || (uri.getRawPath() != null && !uri.getRawPath().isEmpty()) || uri.getRawQuery() != null
                || uri.getRawFragment() != null) {
                throw new IllegalStateException("CORS_ALLOWED_ORIGINS must list exact origins like https://app.example.com");
            }
        }
        return origins;
    }

    private static void writeError(HttpServletResponse response, HttpStatus status, String code) throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        String trace = MDC.get("traceId");
        response.getWriter().write("{\"status\":" + status.value() + ",\"code\":\"" + code + "\",\"traceId\":"
            + (trace == null ? "null" : "\"" + trace + "\"") + "}");
    }
}
