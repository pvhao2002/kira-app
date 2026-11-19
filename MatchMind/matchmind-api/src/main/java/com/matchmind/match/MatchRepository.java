package com.matchmind.match;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

public interface MatchRepository extends JpaRepository<Match, UUID> {
    Optional<Match> findByProviderIdAndExternalMatchId(UUID providerId, String externalMatchId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from Match m where m.providerId = ?1 and m.externalMatchId = ?2")
    Optional<Match> lockByProviderAndExternalId(UUID providerId, String externalMatchId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from Match m where m.id = ?1")
    Optional<Match> lockById(UUID id);
}
