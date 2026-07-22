package com.kira.bank.investment.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "investment_task_settlements")
public class TaskSettlement extends AuditedEntity {
    private Long userId;
    private Long investmentTaskId;
    private Instant settlementDate;
    private BigDecimal totalReceived, capitalReturned, profitReceived, rewardReceived, fee, netReceived;
    private String referenceNumber, status;
    private Long attachmentId;
    @Column(columnDefinition = "TEXT")
    private String note;
    private String idempotencyKey;
}

