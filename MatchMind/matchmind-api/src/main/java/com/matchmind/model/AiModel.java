package com.matchmind.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ai_models")
@Getter
@Setter
public class AiModel {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "provider_id", nullable = false, updatable = false)
    private UUID providerId;
    @Column(nullable = false)
    private String name;
    @Column(nullable = false)
    private String version;
    private String description;
    @Column(nullable = false)
    private String status = "ACTIVE";
    /** Read-only here: V24 columns are written by SQL (admin actions), never by a stale entity save. */
    @Column(name = "display_name", insertable = false, updatable = false)
    private String displayName;
    @Column(name = "merged_into_id", insertable = false, updatable = false)
    private UUID mergedIntoId;
    @Column(name = "archived_at", insertable = false, updatable = false)
    private Instant archivedAt;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = updatedAt = Instant.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
