package com.matchmind.settlement;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PickResultRepository extends JpaRepository<PickResult, UUID> {
    Optional<PickResult> findByPickIdAndCurrentTrue(UUID pickId);

    List<PickResult> findByPickIdInAndCurrentTrue(Collection<UUID> pickIds);

    List<PickResult> findByPickIdInOrderBySettledAtDesc(Collection<UUID> pickIds);
}
