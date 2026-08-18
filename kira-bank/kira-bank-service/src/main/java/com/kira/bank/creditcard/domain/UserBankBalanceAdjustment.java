package com.kira.bank.creditcard.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "user_bank_balance_adjustments",
    uniqueConstraints = @UniqueConstraint(name = "uk_user_bank_balance_adjustments_version",
        columnNames = {"user_id", "bank_id", "balance_version"}))
public class UserBankBalanceAdjustment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, updatable = false)
    private Long userId;

    @Column(nullable = false, updatable = false)
    private Long bankId;

    @Column(nullable = false, updatable = false)
    private long balanceVersion;

    @Column(nullable = false, updatable = false, precision = 19, scale = 4)
    private BigDecimal sourceBalance;

    @Column(nullable = false, updatable = false, precision = 19, scale = 4)
    private BigDecimal previousBalance;

    @Column(nullable = false, updatable = false, precision = 19, scale = 4)
    private BigDecimal newBalance;

    @Column(nullable = false, updatable = false, precision = 19, scale = 4)
    private BigDecimal adjustmentAmount;

    @Column(nullable = false, updatable = false, precision = 19, scale = 4)
    private BigDecimal balanceOffset;

    @Column(nullable = false, updatable = false, length = 500)
    private String reason;

    @Column(nullable = false, updatable = false, length = 3)
    private String currency;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false, updatable = false)
    private Long createdBy;
}
