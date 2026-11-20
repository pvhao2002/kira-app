package com.matchmind.security;

import com.matchmind.external.ExternalAuditService;
import com.matchmind.external.ExternalPingController;
import com.matchmind.provider.ProviderService;
import com.matchmind.security.Principals.ProviderPrincipal;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Machine-to-machine authentication for /api/v1/external/**. Every AI agent uses the one shared key (X-Api-Key,
 * from EXTERNAL_API_KEY) and names itself in X-Provider; an unknown provider is created on its first call.
 * Rejections are audited.
 */
@Component
public class ApiKeyAuthenticationFilter extends OncePerRequestFilter {
    public static final String HEADER = "X-Api-Key";
    public static final String PROVIDER_HEADER = "X-Provider";
    /** For agents that cannot set custom headers (e.g. ChatGPT Actions): ?provider= on the request URL. */
    public static final String PROVIDER_PARAM = "provider";
    private static final Pattern PROVIDER_CODE = Pattern.compile("[a-z0-9][a-z0-9_-]{1,63}");
    private final byte[] keyHash;
    private final ProviderService providers;
    private final ExternalAuditService audit;

    public ApiKeyAuthenticationFilter(@Value("${app.external-api-key:}") String key, ProviderService providers,
                                      ExternalAuditService audit) {
        if (key == null || key.length() < 32) {
            throw new IllegalStateException("EXTERNAL_API_KEY must be set to at least 32 characters");
        }
        this.keyHash = sha256(key);
        this.providers = providers;
        this.audit = audit;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        // Only GET on the ping is public (SecurityConfig); any other method there still goes through the key check.
        return !uri.startsWith("/api/v1/external/")
            || ("GET".equals(request.getMethod()) && uri.equals(ExternalPingController.PATH));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
        throws ServletException, IOException {
        Instant received = Instant.now();
        String key = req.getHeader(HEADER);
        // Compare hashes so the comparison is constant-time and independent of the presented length.
        if (key == null || !MessageDigest.isEqual(sha256(key), keyHash)) {
            reject(req, res, received, 401, "INVALID_API_KEY", key == null ? "Missing API key" : "Invalid API key");
            return;
        }
        String raw = req.getHeader(PROVIDER_HEADER);
        if (raw == null || raw.isBlank()) raw = req.getParameter(PROVIDER_PARAM);
        if (raw == null || raw.isBlank()) {
            reject(req, res, received, 400, "PROVIDER_REQUIRED", "Send your provider name in the X-Provider header");
            return;
        }
        String code = providerCode(raw);
        if (code == null) {
            reject(req, res, received, 400, "INVALID_PROVIDER", "X-Provider must be 2-64 characters: a-z, 0-9, '-' or '_'");
            return;
        }
        UUID providerId = providers.resolve(code);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
            new ProviderPrincipal(providerId, code), null, List.of(new SimpleGrantedAuthority("ROLE_PROVIDER"))));
        chain.doFilter(req, res);
    }

    /** The normalized provider code, or null when it is not 2-64 characters of a-z, 0-9, '-' or '_'. */
    public static String providerCode(String raw) {
        String code = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
        return PROVIDER_CODE.matcher(code).matches() ? code : null;
    }

    private void reject(HttpServletRequest req, HttpServletResponse res, Instant received, int status, String code,
                        String message) throws IOException {
        audit.record(req, received, new ExternalAuditService.Entry(null, null, status, "REJECTED", null, message));
        res.setStatus(status);
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        res.getWriter().write("{\"status\":" + status + ",\"code\":\"" + code + "\",\"message\":\"" + message + "\"}");
    }

    private static byte[] sha256(String value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
