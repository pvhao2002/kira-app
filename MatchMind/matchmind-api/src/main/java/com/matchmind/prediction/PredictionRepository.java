package com.matchmind.prediction;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PredictionRepository extends JpaRepository<Prediction, UUID> {
    Optional<Prediction> findByProviderIdAndExternalEventId(UUID providerId, String externalEventId);
}
