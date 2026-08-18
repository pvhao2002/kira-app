package com.kira.bank.investment.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "investment_accounts")
public class InvestmentAccount extends AuditedEntity {
    @Column(name = "user_id", nullable = false)
    private Long userId;
    private String accountCode;
    private String accountName;
    private String externalAccountCode;
    private String accountUsername;
    private String accountEmail;
    private String phoneNumber;
    private LocalDate registerDate;
    private String accountPassword;
    @Column(length = 3, columnDefinition = "CHAR(3)")
    private String currency = "VND";
    private String status = "ACTIVE";
    @Column(columnDefinition = "TEXT")
    private String note;
}

