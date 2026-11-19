package com.matchmind.prediction;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Immutable;

import java.math.BigDecimal;
import java.util.UUID;

/** Predicted FINAL score of the match (not only goals still to come). */
@Entity
@Immutable
@Table(name = "prediction_correct_scores")
@Getter
@Setter
public class PredictionCorrectScore {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "prediction_id", nullable = false)
    private UUID predictionId;
    @Column(name = "score_rank", nullable = false)
    private int scoreRank = 1;
    @Column(name = "home_score", nullable = false)
    private int homeScore;
    @Column(name = "away_score", nullable = false)
    private int awayScore;
    private BigDecimal probability;
}
