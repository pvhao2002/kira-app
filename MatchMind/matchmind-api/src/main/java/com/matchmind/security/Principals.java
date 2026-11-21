package com.matchmind.security;

import com.matchmind.provider.ProviderKeyService;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

/** Authentication principals: humans (JWT) and machine callers (per-provider key, or the legacy shared key + X-Provider). */
public final class Principals {
    private Principals() {
    }

    /**
     * The token fields describe the JWT of this request: its id, its expiry and when the sign-in it descends from
     * happened (refresh keeps that). They are null where the principal did not come from a JWT.
     */
    public record UserPrincipal(UUID id, String username, String role, UUID tokenId, Instant tokenExpiresAt,
                                Instant sessionStartedAt) {
        public UserPrincipal(UUID id, String username, String role) {
            this(id, username, role, null, null, null);
        }
    }

    /**
     * A machine caller. {@code apiKeyId} is the per-provider key it used; null for the legacy shared key and the admin
     * import, which may call every endpoint (all scopes) until the cut-over.
     */
    public record ProviderPrincipal(UUID providerId, String providerCode, UUID apiKeyId, Set<String> scopes) {
        public ProviderPrincipal(UUID providerId, String providerCode) {
            this(providerId, providerCode, null, ProviderKeyService.ALL_SCOPES);
        }
    }
}
