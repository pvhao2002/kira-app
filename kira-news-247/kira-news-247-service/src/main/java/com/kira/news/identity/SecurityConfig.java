package com.kira.news.identity;

import com.kira.news.shared.Protobuf;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;

/**
 * Session-cookie auth for the admin (browser-only clients, one service: nothing to gain from JWT).
 * CSRF uses the XSRF-TOKEN cookie / X-XSRF-TOKEN header pair that Angular's HttpClient sends natively.
 */
@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        var csrfHandler = new CsrfTokenRequestAttributeHandler();
        csrfHandler.setCsrfRequestAttributeName(null); // load the token on every request so the cookie is always set
        return http
                .csrf(csrf -> csrf
                        .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                        .csrfTokenRequestHandler(csrfHandler)
                        // anonymous beacon from readers' browsers; carries no session authority
                        .ignoringRequestMatchers("/api/v1/public/**"))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/v1/admin/dashboard", "/api/v1/admin/reads/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/v1/admin/categories/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/v1/admin/categories/**").hasRole("ADMIN")
                        .requestMatchers("/api/v1/admin/**").authenticated()
                        .anyRequest().permitAll())
                .securityContext(context -> context.securityContextRepository(securityContextRepository()))
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((_, response, _) ->
                                Protobuf.writeError(response, 401, "UNAUTHENTICATED", "Vui lòng đăng nhập."))
                        .accessDeniedHandler((_, response, _) ->
                                Protobuf.writeError(response, 403, "FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.")))
                .formLogin(form -> form.disable())
                .httpBasic(basic -> basic.disable())
                .logout(logout -> logout.disable())
                .build();
    }

    @Bean
    SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    UserDetailsService userDetailsService(NewsUserRepository users) {
        return username -> users.findByUsername(username)
                .map(CurrentUser::new)
                .orElseThrow(() -> new UsernameNotFoundException(username));
    }

    @Bean
    AuthenticationManager authenticationManager(UserDetailsService userDetailsService, PasswordEncoder passwordEncoder) {
        var provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        return new ProviderManager(provider);
    }
}
