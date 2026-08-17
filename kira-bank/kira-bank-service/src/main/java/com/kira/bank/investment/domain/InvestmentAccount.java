package com.kira.bank.investment.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@Entity
@Table(name = "investment_accounts")
public class InvestmentAccount extends AuditedEntity {
    @Column(name = "user_id", nullable = false)
    private Long userId;
    @Column(name = "platform_id", nullable = true)
    private Long platformId = 1L;
    private String accountCode;
    private String accountName;
    private String externalAccountCode;
    private String accountUsername;
    private String accountEmail;
    private String phoneNumber;
    private java.time.Instant registerDate;
    private String accountPassword;
    private String currency = "VND";
    private BigDecimal currentBalance = BigDecimal.ZERO;
    private BigDecimal availableCapital = BigDecimal.ZERO;
    private BigDecimal lockedCapital = BigDecimal.ZERO;
    private BigDecimal accumulatedProfit = BigDecimal.ZERO;
    private BigDecimal accumulatedReward = BigDecimal.ZERO;
    private BigDecimal reservedWithdrawal = BigDecimal.ZERO;
    private String status = "ACTIVE";
    @Column(columnDefinition = "TEXT")
    private String note;
}

