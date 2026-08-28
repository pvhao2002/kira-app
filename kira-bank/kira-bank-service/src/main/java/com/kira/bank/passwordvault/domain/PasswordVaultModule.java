package com.kira.bank.passwordvault.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "password_vault_modules")
public class PasswordVaultModule extends AuditedEntity {
    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(name = "website_url", length = 1000)
    private String websiteUrl;

    @Column(length = 1000)
    private String description;
}
