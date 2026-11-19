package com.matchmind.model;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface AiModelRepository extends JpaRepository<AiModel, UUID> {
    Optional<AiModel> findByProviderIdAndNameAndVersion(UUID providerId, String name, String version);

    @Modifying
    @Query(value = "INSERT INTO ai_models (provider_id, name, version) VALUES (:providerId, :name, :version) "
        + "ON CONFLICT (provider_id, name, version) DO NOTHING", nativeQuery = true)
    int insertIfMissing(@Param("providerId") UUID providerId, @Param("name") String name, @Param("version") String version);
}
