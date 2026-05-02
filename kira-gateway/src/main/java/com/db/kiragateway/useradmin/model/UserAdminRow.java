package com.db.kiragateway.useradmin.model;

import java.time.LocalDateTime;

public record UserAdminRow(
        int userId,
        String username,
        String status,
        String role,
        String avatar,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
