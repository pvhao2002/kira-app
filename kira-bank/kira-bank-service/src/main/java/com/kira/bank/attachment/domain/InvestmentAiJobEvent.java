package com.kira.bank.attachment.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Immutable;

import java.time.Instant;

@Getter
@Setter
@Entity
@Immutable
@Table(name = "investment_ai_job_events")
public class InvestmentAiJobEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, updatable = false)
    private Long attachmentId;

    @Enumerated(EnumType.STRING)
    @Column(length = 30, updatable = false)
    private AttachmentAiStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30, updatable = false)
    private AttachmentAiStatus toStatus;

    @Column(nullable = false, updatable = false)
    private int attemptCount;

    @Column(nullable = false, length = 100, updatable = false)
    private String reasonCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, updatable = false)
    private InvestmentAiJobEventActor actorType;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;
}
