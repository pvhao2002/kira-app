package com.kira.bank.ai.application;

import com.kira.bank.ai.domain.AiProviderAccountStatus;
import jakarta.validation.constraints.*;

import java.time.Instant;

public final class AiProviderAccountDtos {
    private AiProviderAccountDtos() {}

    public record CreateRequest(
        @NotBlank @Size(max = 100) String displayName,
        @NotBlank @Size(max = 64) @Pattern(regexp = "[0-9a-fA-F]{32}") String accountId,
        @Size(max = 2048) String apiToken,
        @Size(max = 180) String aiModel,
        @Min(0) @Max(100000) int priority,
        @Size(max = 2048) String r2AccessKeyId,
        @Size(max = 2048) String r2SecretAccessKey,
        @Size(max = 255) String r2BucketName,
        @Size(max = 500) String r2PublicUrl
    ) {}

    public record UpdateRequest(
        @NotBlank @Size(max = 100) String displayName,
        @Size(max = 64) @Pattern(regexp = "[0-9a-fA-F]{32}") String accountId,
        @Size(max = 2048) String apiToken,
        @Size(max = 180) String aiModel,
        @Min(0) @Max(100000) int priority,
        @Size(max = 2048) String r2AccessKeyId,
        @Size(max = 2048) String r2SecretAccessKey,
        @Size(max = 255) String r2BucketName,
        @Size(max = 500) String r2PublicUrl,
        @NotNull Long version
    ) {}

    public record VersionRequest(@NotNull Long version) {}
    public record AiTestRequest(@NotNull Long version, @Size(max = 2048) String apiToken,
                                @Size(max = 180) String model) {}
    public record R2TestRequest(@NotNull Long version, @Size(max = 2048) String accessKeyId,
                                @Size(max = 2048) String secretAccessKey,
                                @Size(max = 255) String bucketName,
                                @Size(max = 500) String publicUrl) {}

    public record AiCapabilityResponse(
        boolean tokenConfigured, String model, int priority, boolean enabled,
        AiProviderAccountStatus status, Instant cooldownUntil, String lastErrorCode,
        Instant lastErrorAt, Instant lastTestedAt, Instant lastSuccessAt
    ) {}

    public record R2CapabilityResponse(
        boolean accessKeyConfigured, boolean secretKeyConfigured, String maskedBucketName,
        String maskedPublicUrl, boolean primary, AiProviderAccountStatus status,
        String lastErrorCode, Instant lastErrorAt, Instant lastTestedAt,
        Instant lastSuccessAt, long attachmentCount
    ) {}

    public record AccountResponse(
        Long id, String displayName, String maskedAccountId, AiCapabilityResponse ai,
        R2CapabilityResponse r2, long legacyAttachmentCount, long version
    ) {}
}
