package com.matchmind.prediction;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PredictionCorrectScoreRepository extends JpaRepository<PredictionCorrectScore, UUID> {
    List<PredictionCorrectScore> findByPredictionIdOrderByScoreRankAsc(UUID predictionId);
}
