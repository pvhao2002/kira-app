package com.kira.bank.attachment.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "attachments")
public class Attachment extends AuditedEntity {
    private Long userId;
    @Column(length = 40)
    private String module;
    @Column(length = 60)
    private String documentType;
    @Column(length = 500)
    private String storageKey;
    private Long r2AccountId;
    private String originalName;
    @Column(length = 100)
    private String mimeType;
    private long sizeBytes;
    @Column(length = 64, columnDefinition = "CHAR(64)")
    private String sha256;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AttachmentAiStatus aiStatus = AttachmentAiStatus.NOT_REQUESTED;

    private int aiAttemptCount;
    @Column(length = 150)
    private String aiModel;
    private Integer aiSchemaVersion;
    @Column(columnDefinition = "LONGTEXT")
    private String aiRawResponse;
    @Column(columnDefinition = "JSON")
    private String aiResult;
    @Column(columnDefinition = "TEXT")
    private String aiError;
    private Instant aiNextAttemptAt;
    private Instant aiProcessingStartedAt;
    private Instant aiCompletedAt;
    private Instant aiConfirmedAt;
    private Instant storagePurgedAt;
}
