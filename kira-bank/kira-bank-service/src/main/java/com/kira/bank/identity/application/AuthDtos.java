package com.kira.bank.identity.application;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.Set;

public final class AuthDtos {
    private AuthDtos() {
    }

    /**
     * Dùng nội bộ (AuthService.register).
     */
    public record RegisterRequest(@Email @NotBlank String email, @NotBlank @Size(min = 8, max = 72) String password,
                                  @NotBlank @Size(max = 150) String fullName, @Size(max = 30) String phone) {
    }

    /**
     * Admin tạo tài khoản — POST /api/v1/admin/users (Swagger).
     */
    public record CreateUserRequest(
        @Email @NotBlank String email,
        @NotBlank @Size(min = 8, max = 72) String password,
        @NotBlank @Size(max = 150) String fullName,
        @Size(max = 30) String phone,
        Set<String> roles
    ) {
    }

    public record LoginRequest(@Email @NotBlank String email, @NotBlank String password) {
    }

    public record ChangePasswordRequest(@NotBlank String currentPassword,
                                        @NotBlank @Size(min = 8, max = 72) String newPassword) {
    }

    public record ProfileResponse(Long id, String email, String fullName, String phone, Set<String> roles) {
    }

    public record AuthResponse(String accessToken, long expiresInSeconds, ProfileResponse user) {
    }

    public record UpdateProfileRequest(@NotBlank @Size(max = 150) String fullName, @Size(max = 30) String phone) {
    }
}

