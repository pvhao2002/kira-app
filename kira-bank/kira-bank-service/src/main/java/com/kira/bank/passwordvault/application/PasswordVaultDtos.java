package com.kira.bank.passwordvault.application;

import jakarta.validation.constraints.*;

import java.time.Instant;

public final class PasswordVaultDtos {
    private PasswordVaultDtos() {}

    public record ModuleRequest(
        @NotBlank @Size(max = 150) String name,
        @Size(max = 1000) @Pattern(regexp = "(?i)^https?://\\S+$") String websiteUrl,
        @Size(max = 1000) String description,
        @PositiveOrZero Long version
    ) {}

    public record ModuleResponse(Long id, String name, String websiteUrl, String description,
                                 long accountCount, long version, Instant createdAt, Instant updatedAt) {}

    public record AccountRequest(
        @NotBlank @Size(max = 150) String displayName,
        @Size(max = 500) String username,
        @NotBlank @Size(max = 4096) String password,
        @Size(max = 1000) @Pattern(regexp = "(?i)^https?://\\S+$") String loginUrl,
        @Size(max = 4000) String note,
        @PositiveOrZero Long version
    ) {}

    public record AccountResponse(Long id, Long moduleId, String displayName, String passwordMasked,
                                  long version, Instant createdAt, Instant updatedAt) {}

    public record VersionRequest(@NotNull @PositiveOrZero Long version) {}
    public record UnlockRequest(@NotBlank @Size(max = 72) String currentPassword) {}
    public record UnlockResponse(String unlockToken, Instant expiresAt) {}

    public enum SecretAction { REVEAL, COPY }
    public enum SecretField { USERNAME, PASSWORD, LOGIN_URL, NOTE }

    public record SecretRequest(@NotNull SecretAction action, SecretField field) {}
    public record SecretResponse(String username, String password, String loginUrl, String note, String value) {}

    public record VaultSecret(String username, String password, String loginUrl, String note) {}
}
