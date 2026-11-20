package com.matchmind.security;

import java.time.Instant;
import java.util.UUID;

/** Authentication principals: humans (JWT) and machine callers (shared API key + X-Provider). */
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

    public record ProviderPrincipal(UUID providerId, String providerCode) {
    }
}
