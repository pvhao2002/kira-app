package com.matchmind.security;

import java.util.UUID;

/** Authentication principals: humans (JWT) and machine callers (shared API key + X-Provider). */
public final class Principals {
    private Principals() {
    }

    public record UserPrincipal(UUID id, String username, String role) {
    }

    public record ProviderPrincipal(UUID providerId, String providerCode) {
    }
}
