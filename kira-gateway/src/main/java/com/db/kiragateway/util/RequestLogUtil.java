package com.db.kiragateway.util;

import jakarta.servlet.http.HttpServletRequest;

public final class RequestLogUtil {

    private RequestLogUtil() {}

    public static String summary(HttpServletRequest req) {
        return "ip=%s, ua=%s, method=%s, uri=%s".formatted(
                resolveClientIp(req),
                req.getHeader("User-Agent"),
                req.getMethod(),
                req.getRequestURI()
        );
    }

    public static String resolveClientIp(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        String realIp = req.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return req.getRemoteAddr();
    }
}
