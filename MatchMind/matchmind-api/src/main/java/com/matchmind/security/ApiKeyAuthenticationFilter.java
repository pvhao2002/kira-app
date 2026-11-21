package com.matchmind.security;

import com.matchmind.external.ExternalAuditService;
import com.matchmind.external.ExternalPingController;
import com.matchmind.provider.ProviderKeyService;
import com.matchmind.provider.ProviderKeyService.KeyMatch;
import com.matchmind.provider.ProviderService;
import com.matchmind.security.Principals.ProviderPrincipal;
import com.matchmind.shared.ApiErrors;
import com.matchmind.shared.ClientIpResolver;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
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
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Machine-to-machine authentication for /api/v1/external/**. A per-provider key ({@code mmk_...}, see
 * {@link ProviderKeyService}) names its provider itself, so X-Provider is optional and must match when sent. The legacy
 * shared key (EXTERNAL_API_KEY, optional) still works while it is set: the caller names itself in X-Provider and an
 * unknown provider is created on its first accepted call. A DISABLED provider is refused on both paths; its status is
 * read on every request (never cached). Rejections are audited.
 */
@Component
public class ApiKeyAuthenticationFilter extends OncePerRequestFilter {
    public static final String HEADER = "X-Api-Key";
    public static final String PROVIDER_HEADER = "X-Provider";
    /** For agents that cannot set custom headers (e.g. ChatGPT Actions): ?provider= on the request URL. */
    public static final String PROVIDER_PARAM = "provider";
    private static final Pattern PROVIDER_CODE = Pattern.compile("[a-z0-9][a-z0-9_-]{1,63}");
    /** SHA-256 of the legacy shared key; null when EXTERNAL_API_KEY is not set (legacy path off). */
    private final byte[] keyHash;
    private final ProviderService providers;
    private final ProviderKeyService keys;
    private final ExternalAuditService audit;
    private final ApiKeyFailureThrottle throttle;
    private final ClientIpResolver ips;

    public ApiKeyAuthenticationFilter(@Value("${app.external-api-key:}") String key, ProviderService providers,
                                      ProviderKeyService keys, ExternalAuditService audit, ApiKeyFailureThrottle throttle,
                                      ClientIpResolver ips) {
        if (key != null && !key.isEmpty() && key.length() < 32) {
            throw new IllegalStateException("EXTERNAL_API_KEY must be empty or at least 32 characters");
        }
        this.keyHash = key == null || key.isEmpty() ? null : sha256(key);
        this.providers = providers;
        this.keys = keys;
        this.audit = audit;
        this.throttle = throttle;
        this.ips = ips;
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
        String raw = req.getHeader(PROVIDER_HEADER);
        if (raw == null || raw.isBlank()) raw = req.getParameter(PROVIDER_PARAM);
        boolean named = raw != null && !raw.isBlank();

        if (key != null && key.startsWith(ProviderKeyService.PREFIX)) {
            Optional<KeyMatch> match = keys.authenticate(key);
            if (match.isEmpty()) {
                invalidKey(req, res, received, key);
                return;
            }
            KeyMatch k = match.get();
            if ("DISABLED".equals(k.providerStatus())) {
                reject(req, res, received, k.providerId(), k.keyRowId(), false, 403, "PROVIDER_DISABLED", "This provider is disabled");
                return;
            }
            if (named && !k.providerCode().equals(providerCode(raw))) {
                reject(req, res, received, k.providerId(), k.keyRowId(), false, 403, "PROVIDER_MISMATCH",
                    "X-Provider does not match the provider of this API key. Leave it out or send your own provider");
                return;
            }
            keys.touch(k.keyRowId());
            authenticate(new ProviderPrincipal(k.providerId(), k.providerCode(), k.keyRowId(), k.scopes()));
            chain.doFilter(req, res);
            return;
        }

        // Compare hashes so the comparison is constant-time and independent of the presented length.
        if (key == null || keyHash == null || !MessageDigest.isEqual(sha256(key), keyHash)) {
            invalidKey(req, res, received, key);
            return;
        }
        if (!named) {
            reject(req, res, received, null, null, true, 400, "PROVIDER_REQUIRED", "Send your provider name in the X-Provider header");
            return;
        }
        String code = providerCode(raw);
        if (code == null) {
            reject(req, res, received, null, null, true, 400, "INVALID_PROVIDER", "X-Provider must be 2-64 characters: a-z, 0-9, '-' or '_'");
            return;
        }
        UUID providerId = providers.resolve(code);
        if (providers.disabled(providerId)) {
            reject(req, res, received, providerId, null, true, 403, "PROVIDER_DISABLED", "This provider is disabled");
            return;
        }
        authenticate(new ProviderPrincipal(providerId, code));
        chain.doFilter(req, res);
    }

    private static void authenticate(ProviderPrincipal principal) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
            principal, null, List.of(new SimpleGrantedAuthority("ROLE_PROVIDER"))));
    }

    /** Unauthenticated floods must not grow the audit table: 429 past the limit, and one row per IP per window. */
    private void invalidKey(HttpServletRequest req, HttpServletResponse res, Instant received, String key) throws IOException {
        String message = key == null ? "Missing API key" : "Invalid API key";
        int hits = throttle.hit(ips.resolve(req));
        if (throttle.exceeded(hits)) {
            res.setHeader("Retry-After", "60");
            ApiErrors.write(req, res, 429, "RATE_LIMITED", "Too many rejected requests from this address. Check the API key and retry in a minute");
        } else if (hits == 1) {
            reject(req, res, received, null, null, false, 401, "INVALID_API_KEY", message);
        } else {
            ApiErrors.write(req, res, 401, "INVALID_API_KEY", message);
        }
    }

    /** The normalized provider code, or null when it is not 2-64 characters of a-z, 0-9, '-' or '_'. */
    public static String providerCode(String raw) {
        String code = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
        return PROVIDER_CODE.matcher(code).matches() ? code : null;
    }

    private void reject(HttpServletRequest req, HttpServletResponse res, Instant received, UUID providerId, UUID apiKeyId,
                        boolean legacy, int status, String code, String message) throws IOException {
        // A legacy provider whose first call is refused has no row yet (UX-077): its id is left out of the audit.
        UUID audited = providerId != null && (apiKeyId != null || providers.exists(providerId)) ? providerId : null;
        audit.record(req, received, new ExternalAuditService.Entry(audited, null, status, "REJECTED", null, message,
            apiKeyId, legacy));
        ApiErrors.write(req, res, status, code, message);
    }

    private static byte[] sha256(String value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
