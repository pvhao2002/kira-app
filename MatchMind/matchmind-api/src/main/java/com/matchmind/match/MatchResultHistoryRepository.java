package com.matchmind.match;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MatchResultHistoryRepository extends JpaRepository<MatchResultHistory, UUID> {
    List<MatchResultHistory> findByMatchIdOrderByChangedAtDesc(UUID matchId);
}
