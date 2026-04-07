package com.db.kiragateway.auth.model;

public record UserCredential(
        int userId,
        String username,
        String passwordHash,
        String status,
        String role,
        String avatar
) {
}
