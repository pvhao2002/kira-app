package com.kira.bank.creditcard.domain;

import com.kira.bank.publiccatalog.domain.Bank;
import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "user_credit_cards")
public class UserCreditCard extends AuditedEntity {
    private Long userId;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bank_id", nullable = false)
    private Bank bank;
    @Column(length = 150)
    private String cardType;
    private String nickname, lastFour;
    private String currency = "VND";
    private Integer statementDay, dueDay;
    private LocalDate openedDate;
    private String status = "ACTIVE";
    @Column(columnDefinition = "TEXT")
    private String note;
}
