package com.kira.bank.creditcard.domain;

import com.kira.bank.publiccatalog.domain.Bank;
import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@Entity
@Table(name = "user_bank_credit_limits",
    uniqueConstraints = @UniqueConstraint(name = "uk_user_bank_credit_limits_owner_bank",
        columnNames = {"user_id", "bank_id"}))
public class UserBankCreditLimit extends AuditedEntity {
    @Column(nullable = false)
    private Long userId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bank_id", nullable = false)
    private Bank bank;

    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal creditLimit;

    @Column(nullable = false, length = 3, columnDefinition = "CHAR(3)")
    private String currency = "VND";

    @Column(nullable = false)
    private long balanceVersion;
}
