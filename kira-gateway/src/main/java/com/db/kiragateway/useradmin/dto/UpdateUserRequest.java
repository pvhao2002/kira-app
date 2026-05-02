package com.db.kiragateway.useradmin.dto;

import jakarta.validation.constraints.Size;

public record UpdateUserRequest(
        @Size(max = 20, message = "role must be at most 20 characters")
        String role,

        @Size(max = 20, message = "status must be at most 20 characters")
        String status
) {
}
