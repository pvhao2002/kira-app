package com.db.kiragateway.auth.model;

public record AuthenticatedUser(
        int userId,
        String username,
        String role,
        String avatar
) {
}
