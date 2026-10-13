package com.kira.bank.storage.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "stored_files")
public class StoredFile extends AuditedEntity {
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StorageProvider provider;
    @Column(name = "storage_key", nullable = false, length = 500)
    private String storageKey;
    @Column(name = "r2_account_id")
    private Long r2AccountId;
    @Column(name = "original_name", nullable = false, length = 200)
    private String originalName;
    @Column(name = "mime_type", nullable = false, length = 150)
    private String mimeType;
    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;
    @Column(nullable = false, length = 64)
    private String sha256;
}
