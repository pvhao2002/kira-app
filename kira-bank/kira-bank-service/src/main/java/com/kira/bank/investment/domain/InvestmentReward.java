package com.kira.bank.investment.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "investment_rewards")
public class InvestmentReward extends AuditedEntity {
    private Long userId, investmentAccountId, investmentTaskId;
    private String rewardType, rewardSource;
    private Instant rewardDate;
    private BigDecimal amount;
    private String status, conditionDescription;
    private Long attachmentId;
    @Column(columnDefinition = "TEXT")
    private String note;
    private String idempotencyKey;
}

