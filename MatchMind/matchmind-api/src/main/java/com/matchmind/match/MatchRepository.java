package com.matchmind.match;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

public interface MatchRepository extends JpaRepository<Match, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from Match m where m.providerId = ?1 and m.externalMatchId = ?2")
    Optional<Match> lockByProviderAndExternalId(UUID providerId, String externalMatchId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from Match m where m.id = ?1")
    Optional<Match> lockById(UUID id);

    // Id-only lookups: they load no entity, so a later lockById in the same transaction reads fresh state.
    @Query("select m.id from Match m where m.providerId = ?1 and m.externalMatchId = ?2")
    Optional<UUID> findIdByProviderAndExternalId(UUID providerId, String externalMatchId);

    @Query("select m.id from Match m where m.providerId = ?1 and m.id = ?2")
    Optional<UUID> findIdByProviderAndId(UUID providerId, UUID id);

    @Query("select p.matchId from Prediction p where p.providerId = ?1 and p.id = ?2")
    Optional<UUID> findIdByProviderAndPrediction(UUID providerId, UUID predictionId);
}
