package com.kira.bank.publiccatalog.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "banks")
public class Bank extends AuditedEntity {
    private Long vietqrId;
    private String code;
    private String name;
    private String shortName;
    private String logoUrl;
    private String bin;
    private String swiftCode;
    private boolean transferSupported;
    private boolean lookupSupported;
    private String website;
    private String hotline;
    private String brandColor;
    @Column(columnDefinition = "TEXT")
    private String description;
    private boolean active;
}
