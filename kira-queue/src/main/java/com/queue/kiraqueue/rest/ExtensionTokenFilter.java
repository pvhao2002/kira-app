package com.queue.kiraqueue.rest;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * Static bearer-token guard for /ext/* (browser extension). Compares SHA-256(token) with
 * KIRA_EXTENSION_TOKEN_SHA256. Empty/invalid config rejects everything (fail closed).
 * Revoke by changing/removing the env value and restarting.
 */
public class ExtensionTokenFilter implements Filter {
    static final long MAX_BODY_BYTES = 5L * 1024 * 1024;
    private static final String PREFIX = "Bearer ";

    private final byte[] expected;

    public ExtensionTokenFilter(String expectedSha256Hex) {
        this.expected = parse(expectedSha256Hex);
    }

    private static byte[] parse(String hex) {
        if (hex == null || hex.isBlank()) {
            return null;
        }
        try {
            var bytes = HexFormat.of().parseHex(hex.strip());
            return bytes.length == 32 ? bytes : null;
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        var req = (HttpServletRequest) request;
        var res = (HttpServletResponse) response;
        if (!authorized(req.getHeader("Authorization"))) {
            res.sendError(HttpServletResponse.SC_UNAUTHORIZED);
            return;
        }
        // ponytail: trusts Content-Length only; chunked bodies are not capped. Add a counting wrapper if needed.
        if (req.getContentLengthLong() > MAX_BODY_BYTES) {
            res.sendError(HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE);
            return;
        }
        chain.doFilter(request, response);
    }

    private boolean authorized(String header) {
        if (expected == null || header == null || !header.startsWith(PREFIX)) {
            return false;
        }
        try {
            var actual = MessageDigest.getInstance("SHA-256")
                    .digest(header.substring(PREFIX.length()).strip().getBytes(StandardCharsets.UTF_8));
            return MessageDigest.isEqual(actual, expected);
        } catch (NoSuchAlgorithmException ex) {
            return false;
        }
    }

    @Configuration
    public static class Registration {
        @Bean
        public FilterRegistrationBean<ExtensionTokenFilter> extensionTokenFilterRegistration(
                @Value("${kira.extension.token-sha256:}") String tokenSha256) {
            var bean = new FilterRegistrationBean<>(new ExtensionTokenFilter(tokenSha256));
            bean.addUrlPatterns("/ext/*");
            return bean;
        }
    }
}
