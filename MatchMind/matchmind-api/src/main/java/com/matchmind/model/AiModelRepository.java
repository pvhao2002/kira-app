package com.matchmind.model;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface AiModelRepository extends JpaRepository<AiModel, UUID> {
    /**
     * The model an agent means: name compared case-insensitively, version with trailing ".0" groups ignored ("1",
     * "1.0" and "1.00" are one version). The first one stored wins, so its spelling is the display name. Same
     * expression as the unique index ux_ai_models_provider_identity (V14).
     */
    @Query(value = "SELECT * FROM ai_models WHERE provider_id = :providerId AND lower(name) = lower(:name) "
        + "AND regexp_replace(lower(version), '(\\.0+)+$', '') = regexp_replace(lower(:version), '(\\.0+)+$', '') "
        + "ORDER BY created_at, id LIMIT 1", nativeQuery = true)
    Optional<AiModel> findSameModel(@Param("providerId") UUID providerId, @Param("name") String name,
                                    @Param("version") String version);

    /** No conflict target: either the exact unique key or the case-insensitive identity index absorbs a race. */
    @Modifying
    @Query(value = "INSERT INTO ai_models (provider_id, name, version) VALUES (:providerId, :name, :version) "
        + "ON CONFLICT DO NOTHING", nativeQuery = true)
    int insertIfMissing(@Param("providerId") UUID providerId, @Param("name") String name, @Param("version") String version);
}
