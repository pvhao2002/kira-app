package com.matchmind.external;

import com.fasterxml.jackson.databind.JsonNode;
import com.matchmind.security.Principals.ProviderPrincipal;
import com.matchmind.security.Principals.UserPrincipal;
import com.matchmind.shared.ClientIpResolver;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Persists callback audit rows in their own transaction so a failed (rolled back) callback is still recorded.
 */
@Service
@RequiredArgsConstructor
public class ExternalAuditService {
    private static final Logger log = LoggerFactory.getLogger(ExternalAuditService.class);
    private final ExternalApiRequestRepository requests;
    private final ClientIpResolver ips;

    /**
     * {@code apiKeyId} and {@code legacyKey} are for rejections made before the caller is authenticated; once it is,
     * both come from the provider principal of the request.
     */
    public record Entry(UUID providerId, String eventId, int httpStatus, String requestStatus,
                        JsonNode result, String error, UUID apiKeyId, boolean legacyKey) {
        public Entry(UUID providerId, String eventId, int httpStatus, String requestStatus, JsonNode result, String error) {
            this(providerId, eventId, httpStatus, requestStatus, result, error, null, false);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public UUID record(HttpServletRequest http, Instant receivedAt, Entry e) {
        ExternalApiRequest row = new ExternalApiRequest();
        row.setProviderId(e.providerId());
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        ProviderPrincipal caller = auth != null && auth.getPrincipal() instanceof ProviderPrincipal p ? p : null;
        // The key belongs to a provider that exists, so it is recorded only together with that provider (composite FK).
        UUID keyId = e.apiKeyId() != null ? e.apiKeyId() : caller == null ? null : caller.apiKeyId();
        row.setApiKeyId(e.providerId() == null ? null : keyId);
        row.setLegacyKey(e.legacyKey() || (caller != null && caller.apiKeyId() == null));
        row.setRequestId(requestId(http));
        row.setEventId(truncate(e.eventId(), 128));
        row.setEndpoint(truncate(http.getRequestURI(), 160));
        row.setHttpMethod(http.getMethod());
        row.setHttpStatus(e.httpStatus());
        row.setRequestStatus(e.requestStatus());
        row.setProcessingResult(e.result());
        row.setErrorMessage(truncate(e.error(), 2000));
        row.setClientIp(ips.resolve(http));
        row.setActor(actor());
        row.setReceivedAt(receivedAt);
        row.setDurationMs((int) Math.max(0, Duration.between(receivedAt, Instant.now()).toMillis()));
        requests.save(row);
        log.info("External callback endpoint={} provider={} apiKey={} legacyKey={} event={} status={} result={} durationMs={}",
            row.getEndpoint(), e.providerId(), row.getApiKeyId(), row.isLegacyKey(), row.getEventId(), e.httpStatus(),
            e.requestStatus(), row.getDurationMs());
        return row.getId();
    }

    /** The signed-in dashboard user, when an admin acted through the UI; never a provider or an anonymous caller. */
    private static String actor() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getPrincipal() instanceof UserPrincipal u ? truncate(u.username(), 64) : null;
    }

    /** Caller-supplied X-Request-Id when well formed; otherwise the trace id assigned to this request. */
    static String requestId(HttpServletRequest http) {
        String id = http.getHeader("X-Request-Id");
        if (id != null && id.matches("[A-Za-z0-9._:-]{1,128}")) return id;
        String trace = org.slf4j.MDC.get("traceId");
        return trace != null ? trace : UUID.randomUUID().toString();
    }

    private static String truncate(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }
}
