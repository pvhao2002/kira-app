package com.kira.memory.identity;

import jakarta.servlet.DispatcherType;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;

import java.io.IOException;

@Configuration
public class SecurityConfig {
    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    SecurityFilterChain security(HttpSecurity http, SessionCookieFilter sessionFilter) throws Exception {
        // CSRF tokens are off: the session cookie is SameSite=Strict and the UI is served from the same origin.
        return http.csrf(c -> c.disable())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            // Media responses set their own Cache-Control; Spring's default "no-cache" would stop Cloudflare caching.
            .headers(h -> h.cacheControl(c -> c.disable()).frameOptions(f -> f.deny())
                .referrerPolicy(r -> r.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.SAME_ORIGIN)))
            .exceptionHandling(e -> e
                .authenticationEntryPoint((req, res, ex) -> write(res, HttpStatus.UNAUTHORIZED, "UNAUTHORIZED"))
                .accessDeniedHandler((req, res, ex) -> write(res, HttpStatus.FORBIDDEN, "FORBIDDEN")))
            .authorizeHttpRequests(a -> a
                // SSE completes on an async dispatch where the stateless filter does not run again.
                .dispatcherTypeMatchers(DispatcherType.ASYNC, DispatcherType.ERROR).permitAll()
                .requestMatchers("/actuator/health", "/api/public/**", "/m/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/login", "/api/auth/logout").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated())
            .addFilterBefore(sessionFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
    }

    private static void write(HttpServletResponse res, HttpStatus status, String code) throws IOException {
        res.setStatus(status.value());
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        res.getWriter().write("{\"status\":" + status.value() + ",\"code\":\"" + code + "\"}");
    }
}
