package com.kira.bank.creditcard.domain;
import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.Instant;
@Getter @Setter @Entity @Table(name="payments")
public class Payment extends AuditedEntity { private Long userId,statementId;private Instant paymentDate;private BigDecimal amount;private String paymentMethod,sourceAccount,referenceNumber,status="COMPLETED";private Long attachmentId;@Column(columnDefinition="TEXT")private String note;private String idempotencyKey; }

