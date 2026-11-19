package com.matchmind.prediction;

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

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Immutable
@Table(name = "prediction_picks")
@Getter
@Setter
public class PredictionPick {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "prediction_id", nullable = false)
    private UUID predictionId;
    @Column(name = "odds_id", nullable = false)
    private UUID oddsId;
    @Column(nullable = false)
    private String market;
    @Column(nullable = false)
    private String pick;
    @Column(nullable = false)
    private BigDecimal probability;
    @Column(name = "pick_rank", nullable = false)
    private int pickRank;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}
