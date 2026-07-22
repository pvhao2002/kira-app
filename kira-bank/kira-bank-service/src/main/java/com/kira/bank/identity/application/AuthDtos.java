package com.kira.bank.identity.application;

import jakarta.validation.constraints.*;
import java.util.Set;

public final class AuthDtos {
    private AuthDtos() {}
    public record RegisterRequest(@Email @NotBlank String email, @NotBlank @Size(min=8,max=72) String password,
                                  @NotBlank @Size(max=150) String fullName, @Size(max=30) String phone) {}
    public record LoginRequest(@Email @NotBlank String email, @NotBlank String password) {}
    public record ChangePasswordRequest(@NotBlank String currentPassword, @NotBlank @Size(min=8,max=72) String newPassword) {}
    public record ProfileResponse(Long id, String email, String fullName, String phone, Set<String> roles) {}
    public record AuthResponse(String accessToken, long expiresInSeconds, ProfileResponse user) {}
    public record UpdateProfileRequest(@NotBlank @Size(max=150) String fullName, @Size(max=30) String phone) {}
}

