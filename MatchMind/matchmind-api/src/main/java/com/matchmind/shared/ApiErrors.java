package com.matchmind.shared;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;

/**
 * Writes the standard error body from code that runs before Spring MVC (security entry points, servlet filters), so
 * a 401 or 403 has the same shape as every other error: timestamp, status, code, message, fieldErrors, path, traceId.
 */
public final class ApiErrors {
    private ApiErrors() {
    }

    public static void write(HttpServletRequest req, HttpServletResponse res, int status, String code, String message)
        throws IOException {
        res.setStatus(status);
        res.setContentType("application/json;charset=UTF-8");
        res.setCharacterEncoding(StandardCharsets.UTF_8.name());
        String traceId = MDC.get("traceId");
        String body = "{\"timestamp\":\"" + Instant.now() + "\",\"status\":" + status + ",\"code\":\"" + escape(code)
            + "\",\"message\":\"" + escape(message) + "\",\"fieldErrors\":{},\"path\":\"" + escape(req.getRequestURI())
            + "\",\"traceId\":" + (traceId == null ? "null" : "\"" + escape(traceId) + "\"") + "}";
        res.getOutputStream().write(body.getBytes(StandardCharsets.UTF_8));
    }

    private static String escape(String s) {
        StringBuilder b = new StringBuilder(s.length());
        for (char c : s.toCharArray()) {
            if (c == '"' || c == '\\') b.append('\\').append(c);
            else if (c < 0x20) b.append(String.format("\\u%04x", (int) c));
            else b.append(c);
        }
        return b.toString();
    }
}
