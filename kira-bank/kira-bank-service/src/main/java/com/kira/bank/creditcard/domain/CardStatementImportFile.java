package com.kira.bank.creditcard.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "card_statement_import_files")
public class CardStatementImportFile extends AuditedEntity {
    private Long importId;
    private Long attachmentId;
    private int pageNumber;
}
