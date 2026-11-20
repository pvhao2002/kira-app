package com.matchmind.prediction;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PredictionStatsRepository extends JpaRepository<PredictionStats, UUID> {
    Optional<PredictionStats> findByPredictionId(UUID predictionId);
}
