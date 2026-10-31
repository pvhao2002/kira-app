package com.kira.news.shared;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/** Protobuf bodies are read fully into memory: refuse oversized ones before parsing (largest legit: a 200k-char article). */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestSizeLimitFilter extends OncePerRequestFilter {
    static final long MAX_BYTES = 1_048_576;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        // shortcut: trusts Content-Length; chunked bodies without it are capped by the proxy in front.
        if (request.getContentLengthLong() > MAX_BYTES) {
            Protobuf.writeError(response, 413, "PAYLOAD_TOO_LARGE", "Nội dung gửi lên quá lớn.");
            return;
        }
        chain.doFilter(request, response);
    }
}
