package com.kira.affiliate.identity.application;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public final class AuthDtos {
    private AuthDtos() {
    }

    public record RegisterRequest(@Email @NotBlank @Size(max = 254) String email,
                                  @NotBlank @Size(min = 8, max = 72) String password,
                                  @NotBlank @Size(max = 150) String fullName) {
    }

    public record LoginRequest(@Email @NotBlank @Size(max = 254) String email,
                               @NotBlank @Size(max = 128) String password) {
    }

    public record ChangePasswordRequest(@NotBlank @Size(max = 128) String currentPassword,
                                        @NotBlank @Size(min = 8, max = 72) String newPassword) {
    }

    public record ProfileResponse(Long id, String email, String fullName, long version) {
    }

    public record AuthResponse(String accessToken, long expiresInSeconds, ProfileResponse user) {
    }

    public record UpdateProfileRequest(@NotBlank @Size(max = 150) String fullName,
                                       @NotNull @PositiveOrZero Long version) {
    }
}
