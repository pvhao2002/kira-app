package com.matchmind.prediction;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface PredictionPickRepository extends JpaRepository<PredictionPick, UUID> {
    List<PredictionPick> findByPredictionIdOrderByPickRankAsc(UUID predictionId);

    @Query("select pk from PredictionPick pk, Prediction p where p.id = pk.predictionId and p.matchId = ?1")
    List<PredictionPick> findByMatchId(UUID matchId);
}
