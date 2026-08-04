package com.kira.bank.attachment.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "attachments")
public class Attachment extends AuditedEntity {
    private Long userId;
    private String module;
    private String documentType;
    private String storageKey;
    private String originalName;
    private String mimeType;
    private long sizeBytes;
    private String sha256;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AttachmentAiStatus aiStatus = AttachmentAiStatus.NOT_REQUESTED;

    private int aiAttemptCount;
    private String aiModel;
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
}
