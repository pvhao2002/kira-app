package com.kira.bank.investment.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "investment_platforms")
public class InvestmentPlatform extends AuditedEntity {
    private String name, code, websiteUrl, logoUrl;
    @Column(columnDefinition = "TEXT")
    private String description;
    private boolean active;
    @Column(columnDefinition = "TEXT")
    private String note;
}

