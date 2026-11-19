package com.matchmind.prediction;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/** Immutable historical snapshot: a new callback always creates a new row, never updates an old one. */
@Entity
@Immutable
@Table(name = "predictions")
@Getter
@Setter
public class Prediction {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "provider_id", nullable = false)
    private UUID providerId;
    @Column(name = "match_id", nullable = false)
    private UUID matchId;
    @Column(name = "ai_model_id", nullable = false)
    private UUID aiModelId;
    @Column(name = "external_event_id", nullable = false)
    private String externalEventId;
    @Column(name = "prediction_type", nullable = false)
    private String predictionType;
    @Column(name = "match_minute")
    private Integer matchMinute;
    @Column(name = "current_home_score")
    private Integer currentHomeScore;
    @Column(name = "current_away_score")
    private Integer currentAwayScore;
    @Column(name = "current_home_corners")
    private Integer currentHomeCorners;
    @Column(name = "current_away_corners")
    private Integer currentAwayCorners;
    @Column(name = "predicted_at", nullable = false)
    private Instant predictedAt;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private JsonNode payload;
    @Column(name = "payload_hash", nullable = false)
    private String payloadHash;
    @JdbcTypeCode(SqlTypes.JSON)
    private JsonNode metadata;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}
