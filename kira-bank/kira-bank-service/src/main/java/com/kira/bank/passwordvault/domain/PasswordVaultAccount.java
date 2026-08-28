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
@Table(name = "password_vault_accounts")
public class PasswordVaultAccount extends AuditedEntity {
    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Column(name = "module_id", nullable = false)
    private Long moduleId;

    @Column(name = "account_uuid", nullable = false, length = 36, updatable = false)
    private String accountUuid;

    @Column(name = "display_name", nullable = false, length = 150)
    private String displayName;

    @Column(name = "secret_ciphertext", nullable = false, columnDefinition = "MEDIUMTEXT")
    private String secretCiphertext;

    @Column(name = "secret_nonce", nullable = false, length = 64)
    private String secretNonce;

    @Column(name = "wrapped_dek_ciphertext", nullable = false, length = 255)
    private String wrappedDekCiphertext;

    @Column(name = "wrapped_dek_nonce", nullable = false, length = 64)
    private String wrappedDekNonce;

    @Column(name = "encryption_key_id", nullable = false, length = 50)
    private String encryptionKeyId;

    @Column(name = "crypto_version", nullable = false)
    private short cryptoVersion;
}
