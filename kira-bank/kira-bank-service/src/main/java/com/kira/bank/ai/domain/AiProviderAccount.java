package com.kira.bank.ai.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "cloudflare_accounts")
public class AiProviderAccount extends AuditedEntity {
    @Column(name = "display_name", nullable = false, length = 100)
    private String displayName;

    @Column(name = "account_id", nullable = false, length = 64)
    private String accountId;

    @Column(name = "ai_api_token_ciphertext", nullable = false, columnDefinition = "TEXT")
    private String apiTokenCiphertext;

    @Column(name = "ai_model", nullable = false, length = 180)
    private String aiModel;

    @Column(name = "ai_priority_order", nullable = false)
    private int priority;

    @Column(name = "ai_enabled", nullable = false)
    private boolean enabled;

    @Enumerated(EnumType.STRING)
    @Column(name = "ai_health_status", nullable = false, length = 30)
    private AiProviderAccountStatus healthStatus;

    @Column(name = "ai_cooldown_until") private Instant cooldownUntil;
    @Column(name = "ai_last_error_code") private String lastErrorCode;
    @Column(name = "ai_last_error_at") private Instant lastErrorAt;
    @Column(name = "ai_last_tested_at") private Instant lastTestedAt;
    @Column(name = "ai_last_success_at") private Instant lastSuccessAt;

    @Column(name = "r2_access_key_ciphertext", columnDefinition = "TEXT")
    private String r2AccessKeyCiphertext;
    @Column(name = "r2_secret_key_ciphertext", columnDefinition = "TEXT")
    private String r2SecretKeyCiphertext;
    @Column(name = "r2_bucket_name") private String r2BucketName;
    @Column(name = "r2_public_url", length = 500) private String r2PublicUrl;
    @Column(name = "r2_primary", nullable = false) private boolean r2Primary;
    @Enumerated(EnumType.STRING)
    @Column(name = "r2_health_status", nullable = false, length = 30)
    private AiProviderAccountStatus r2HealthStatus;
    @Column(name = "r2_last_error_code") private String r2LastErrorCode;
    @Column(name = "r2_last_error_at") private Instant r2LastErrorAt;
    @Column(name = "r2_last_tested_at") private Instant r2LastTestedAt;
    @Column(name = "r2_last_success_at") private Instant r2LastSuccessAt;
}
