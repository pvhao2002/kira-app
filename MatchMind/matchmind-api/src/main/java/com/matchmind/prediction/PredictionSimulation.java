package com.matchmind.prediction;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Immutable
@Table(name = "prediction_simulations")
@Getter
@Setter
public class PredictionSimulation {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "prediction_id", nullable = false)
    private UUID predictionId;
    @Column(nullable = false)
    private String method;
    @Column(name = "simulation_count", nullable = false)
    private int simulationCount;
    @Column(name = "random_seed")
    private Long randomSeed;
    @Column(name = "expected_remaining_home_goals")
    private BigDecimal expectedRemainingHomeGoals;
    @Column(name = "expected_remaining_away_goals")
    private BigDecimal expectedRemainingAwayGoals;
    @Column(name = "expected_remaining_home_corners")
    private BigDecimal expectedRemainingHomeCorners;
    @Column(name = "expected_remaining_away_corners")
    private BigDecimal expectedRemainingAwayCorners;
    @Column(name = "algorithm_version")
    private String algorithmVersion;
    @JdbcTypeCode(SqlTypes.JSON)
    private JsonNode parameters;
    @JdbcTypeCode(SqlTypes.JSON)
    private JsonNode probabilities;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "correct_score_distribution")
    private JsonNode correctScoreDistribution;
}
