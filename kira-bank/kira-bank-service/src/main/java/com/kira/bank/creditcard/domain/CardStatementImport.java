package com.kira.bank.creditcard.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "card_statement_imports")
public class CardStatementImport extends AuditedEntity {
    private Long userId;
    private Long userCardId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private CardStatementImportStatus status = CardStatementImportStatus.QUEUED;
    private int attemptCount;
    private Instant nextAttemptAt;
    private Instant processingStartedAt;
    @Column(length = 150)
    private String aiModel;
    @Column(columnDefinition = "JSON")
    private String aiResult;
    @Column(length = 100)
    private String aiError;
    private Long statementId;
    @Column(columnDefinition = "JSON")
    private String confirmResult;
    private Instant completedAt;
    private Instant retentionUntil;
    private Instant storagePurgedAt;
}
