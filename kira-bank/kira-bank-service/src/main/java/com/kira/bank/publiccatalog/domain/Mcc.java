package com.kira.bank.publiccatalog.domain;
import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
@Getter @Setter @Entity @Table(name="mccs")
public class Mcc extends AuditedEntity { private String code; private String name; private String category; @Column(columnDefinition="TEXT") private String description; private String merchantType; private boolean active; }

