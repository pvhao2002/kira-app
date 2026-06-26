package com.db.kiragateway.config.security;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.nimbusds.jose.proc.SecurityContext;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver;
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.time.Duration;
import java.util.List;
import java.util.Optional;

@Configuration
@EnableMethodSecurity
@EnableConfigurationProperties(AppSecurityProperties.class)
public class SecurityConfig {

    /**
     * Crawl / worker callbacks (kira-crawl, internal jobs): no JWT, no CSRF — server-to-server only.
     * Matched before the default chain so OAuth2 Resource Server never runs on these paths.
     */
    @Bean
    @Order(1)
    public SecurityFilterChain crawlCallbackSecurityFilterChain(HttpSecurity http) throws Exception {
        http
                .securityMatcher("/crawl/**")
                .csrf(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
        return http.build();
    }

    @Bean
    @Order(2)
    public SecurityFilterChain securityFilterChain(HttpSecurity http,
                                                   BearerTokenResolver bearerTokenResolver,
                                                   JwtAuthenticationConverter jwtAuthenticationConverter,
                                                   CorsConfigurationSource corsConfigurationSource) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .csrf(csrf -> csrf
                        .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                        .ignoringRequestMatchers(this::isPublicAuthPost)
                )
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/").permitAll()
                        .requestMatchers("/auth/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/internal/auth/register").permitAll()
                        .requestMatchers(HttpMethod.POST, "/internal/auth/password").permitAll()
                        .requestMatchers(HttpMethod.GET, "/events/claim/next").permitAll()
                        .requestMatchers(HttpMethod.GET, "/events/*").permitAll()
                        .requestMatchers(HttpMethod.GET, "/export/kira-crawl").permitAll()
                        .requestMatchers(HttpMethod.GET, "/travel-checklists/public").permitAll()
                        .anyRequest().authenticated()
                )
                .oauth2ResourceServer(oauth2 -> oauth2
                        .bearerTokenResolver(bearerTokenResolver)
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter)))
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource(AppSecurityProperties props) {
        var config = new CorsConfiguration();
        // Exact origins (e.g. http://localhost:4200) miss loopback aliases like http://127.0.2.3:4200 → CorsFilter 403.
        config.setAllowedOriginPatterns(CorsOriginPatterns.buildAllowedOriginPatterns(props.getCors().getAllowedOrigins()));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-XSRF-TOKEN"));
        config.setAllowCredentials(true);
        config.setMaxAge(Duration.ofHours(1));

        var source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public BearerTokenResolver bearerTokenResolver(AppSecurityProperties props) {
        var defaultResolver = new DefaultBearerTokenResolver();
        defaultResolver.setAllowUriQueryParameter(false);

        return request -> {
            // Stale/expired JWT in HttpOnly cookie breaks permitAll endpoints (Resource Server validates before permitAll).
            if (isPublicAuthPost(request) || isPublicTravelChecklistGet(request)) {
                return defaultResolver.resolve(request);
            }
            return readCookieToken(request, props.getCookie().getName())
                    .orElseGet(() -> defaultResolver.resolve(request));
        };
    }

    /**
     * POSTs that must work without a valid JWT cookie (login/logout with stale cookie; register; password reset).
     * Path must tolerate proxy/nginx quirks: optional duplicate {@code /gateway} prefix on the dispatch path.
     */
    private boolean isPublicAuthPost(HttpServletRequest request) {
        if (!HttpMethod.POST.matches(request.getMethod())) {
            return false;
        }
        var path = normalizeDispatchPath(request);
        return "/auth/login".equals(path)
                || "/auth/logout".equals(path)
                || "/internal/auth/register".equals(path)
                || "/internal/auth/password".equals(path);
    }

    private boolean isPublicTravelChecklistGet(HttpServletRequest request) {
        if (!HttpMethod.GET.matches(request.getMethod())) {
            return false;
        }
        return "/travel-checklists/public".equals(normalizeDispatchPath(request));
    }

    /**
     * Servlet path within the gateway app, with defensive stripping if {@code /gateway} appears twice
     * (some proxies / misconfigurations).
     */
    private static String normalizeDispatchPath(HttpServletRequest request) {
        var p = request.getServletPath();
        if (request.getPathInfo() != null) {
            p = p + request.getPathInfo();
        }
        if (p == null || p.isEmpty()) {
            p = "/";
        }
        if (p.startsWith("/gateway")) {
            p = p.substring("/gateway".length());
            if (p.isEmpty()) {
                p = "/";
            }
        }
        return p;
    }

    @Bean
    public JwtDecoder jwtDecoder(AppSecurityProperties props) {
        var key = JwtSigningKeySupport.hmacSha256Key(props.getJwt().getSecret());
        var decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
        OAuth2TokenValidator<Jwt> withIssuer = JwtValidators.createDefaultWithIssuer(props.getJwt().getIssuer());
        OAuth2TokenValidator<Jwt> withClockSkew = new JwtTimestampValidator(Duration.ofSeconds(30));
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(withIssuer, withClockSkew));
        return decoder;
    }

    @Bean
    public JwtEncoder jwtEncoder(AppSecurityProperties props) {
        var key = JwtSigningKeySupport.hmacSha256Key(props.getJwt().getSecret());
        return new NimbusJwtEncoder(new ImmutableSecret<SecurityContext>(key));
    }

    @Bean
    public JwtAuthenticationConverter jwtAuthenticationConverter() {
        var converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(jwt -> {
            var role = jwt.getClaimAsString("role");
            if (role == null || role.isBlank()) {
                return List.of();
            }
            return List.of(new SimpleGrantedAuthority("ROLE_" + role.trim().toUpperCase()));
        });
        converter.setPrincipalClaimName("sub");
        return converter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    private Optional<String> readCookieToken(HttpServletRequest request, String cookieName) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null || cookieName == null || cookieName.isBlank()) {
            return Optional.empty();
        }

        for (Cookie cookie : cookies) {
            if (cookieName.equals(cookie.getName()) && cookie.getValue() != null && !cookie.getValue().isBlank()) {
                return Optional.of(cookie.getValue());
            }
        }
        return Optional.empty();
    }
}
