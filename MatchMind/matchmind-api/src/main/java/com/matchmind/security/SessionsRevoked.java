package com.matchmind.security;

import java.util.UUID;

/**
 * Published when a user's tokens stop being valid, so long-lived connections (event streams) end now instead of
 * waiting for their next check. {@code tokenId} null means every session of the user, otherwise that one session.
 */
public record SessionsRevoked(UUID userId, UUID tokenId) {
}
