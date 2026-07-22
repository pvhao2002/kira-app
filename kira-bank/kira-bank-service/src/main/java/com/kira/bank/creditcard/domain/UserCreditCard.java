package com.kira.bank.creditcard.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "user_credit_cards")
public class UserCreditCard extends AuditedEntity {
    private Long userId, cardCatalogId;
    private String nickname, lastFour;
    private BigDecimal creditLimit;
    private String currency = "VND";
    private Integer statementDay, dueDay;
    private LocalDate openedDate;
    private String status = "ACTIVE";
    @Column(columnDefinition = "TEXT")
    private String note;
}

