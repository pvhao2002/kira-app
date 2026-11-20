package com.matchmind.prediction;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PredictionOddsRepository extends JpaRepository<PredictionOdds, UUID> {
    List<PredictionOdds> findByPredictionIdOrderByMarketAscOddsStageAscSnapshotOrderAsc(UUID predictionId);
}
