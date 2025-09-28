package com.app.kira.config;

import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configurers.HeadersConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor(onConstructor_ = @Autowired)
@FieldDefaults(makeFinal = true, level = lombok.AccessLevel.PRIVATE)
public class WebSecurityConfig {
    JwtAuthenticationFilter jwtAuthenticationFilter;
    AuthenticationProvider authenticationProvider;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws
            Exception {
        return http
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(sess -> sess.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .cors(cors -> cors.configurationSource(corsConfiguration()))
                .authorizeHttpRequests(auth -> auth
                        .anyRequest().permitAll()
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .formLogin(AbstractHttpConfigurer::disable)
                .headers(headers -> headers.cacheControl(HeadersConfigurer.CacheControlConfig::disable))
                .authenticationProvider(authenticationProvider)
                .build();
    }

    @Bean
    public CorsConfigurationSource corsConfiguration() {
        var corsConfig = new CorsConfiguration();
        corsConfig.setAllowedOriginPatterns(Collections.singletonList("*"));
        corsConfig.setAllowedMethods(List.of("*"));
        corsConfig.setAllowedHeaders(List.of("*"));
        corsConfig.setAllowCredentials(true);
        var source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", corsConfig);
        return source;
    }

    @Bean
    @ConfigurationProperties(prefix = "application.ignored.urls")
    public List<String> ignoredUrls() {
        return new ArrayList<>();
    }
}
