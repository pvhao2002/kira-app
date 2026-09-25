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
@Table(name = "card_transactions")
public class CardTransaction extends AuditedEntity {
    private Long userId;
    private Long userCardId;
    private Long statementId;
    private Long importId;
    @Column(nullable = false)
    private LocalDate transactionDate;
    private LocalDate postingDate;
    @Column(length = 500, nullable = false)
    private String description;
    @Column(precision = 19, scale = 4, nullable = false)
    private BigDecimal amount;
    @Column(length = 3, columnDefinition = "CHAR(3)", nullable = false)
    private String currency;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CardTransactionType transactionType;
    @Column(length = 4, columnDefinition = "CHAR(4)")
    private String mccCode;
    private Long cashbackRuleId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CardTransactionSource source;
    @Column(nullable = false, columnDefinition = "BINARY(32)")
    private byte[] dedupKey;
}
