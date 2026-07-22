package com.kira.bank.investment.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "investment_ledger_entries")
public class LedgerEntry {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Long userId, investmentAccountId;
    private Instant entryDate;
    private String entryType;
    private BigDecimal amount;
    private String currency;
    private BigDecimal balanceBefore, balanceAfter;
    private String referenceType;
    private Long referenceId;
    private String description;
    private Long createdBy;
    private Instant createdAt;
    private String idempotencyKey;

    @PrePersist
    void created() {
        if (createdAt == null) createdAt = Instant.now();
    }
}

