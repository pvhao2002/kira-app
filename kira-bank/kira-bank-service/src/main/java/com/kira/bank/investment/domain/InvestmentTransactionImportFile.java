package com.kira.bank.investment.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/** Link between an investment account and an uploaded receipt; processedAt is set once items were created. */
@Getter
@Setter
@Entity
@Table(name = "investment_transaction_import_files")
public class InvestmentTransactionImportFile extends AuditedEntity {
    @Column(nullable = false)
    private Long investmentAccountId;
    @Column(nullable = false)
    private Long attachmentId;
    private Instant processedAt;
}
