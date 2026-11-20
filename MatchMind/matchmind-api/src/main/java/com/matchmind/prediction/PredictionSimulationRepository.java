package com.matchmind.prediction;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PredictionSimulationRepository extends JpaRepository<PredictionSimulation, UUID> {
    Optional<PredictionSimulation> findByPredictionId(UUID predictionId);
}
