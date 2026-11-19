package com.matchmind.settlement;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/** Append-only settlement history. Only is_current/superseded_* ever change, when a newer row replaces it. */
@Entity
@Table(name = "prediction_pick_results")
@Getter
@Setter
public class PickResult {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "pick_id", nullable = false, updatable = false)
    private UUID pickId;
    @Column(nullable = false, updatable = false)
    private String result;
    @Column(name = "settled_at", nullable = false, updatable = false)
    private Instant settledAt;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, updatable = false)
    private JsonNode details;
    @Column(nullable = false, updatable = false)
    private String source;
    @Column(name = "calculation_version", nullable = false, updatable = false)
    private String calculationVersion;
    @Column(name = "is_current", nullable = false)
    private boolean current = true;
    @Column(name = "superseded_at")
    private Instant supersededAt;
    @Column(name = "superseded_by")
    private UUID supersededBy;
    @Column(updatable = false)
    private String reason;
    @Column(name = "created_by", updatable = false)
    private UUID createdBy;
}
