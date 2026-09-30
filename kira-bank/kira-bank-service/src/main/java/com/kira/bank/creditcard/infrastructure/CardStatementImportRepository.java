package com.kira.bank.creditcard.infrastructure;

import com.kira.bank.creditcard.domain.CardStatementImport;
import com.kira.bank.creditcard.domain.CardStatementImportStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface CardStatementImportRepository extends JpaRepository<CardStatementImport, Long> {
    Optional<CardStatementImport> findByIdAndUserIdAndDeletedAtIsNull(Long id, Long userId);

    List<CardStatementImport> findByUserIdAndUserCardIdAndDeletedAtIsNullOrderByCreatedAtDesc(
        Long userId, Long userCardId, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from CardStatementImport i where i.id = :id and i.userId = :userId and i.deletedAt is null")
    Optional<CardStatementImport> findOwnedForUpdate(@Param("id") Long id, @Param("userId") Long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from CardStatementImport i where i.id = :id and i.deletedAt is null")
    Optional<CardStatementImport> findForUpdate(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        select i from CardStatementImport i
        where i.deletedAt is null
          and i.status = :status
          and (i.nextAttemptAt is null or i.nextAttemptAt <= :now)
        order by i.createdAt asc
        """)
    List<CardStatementImport> findClaimableForUpdate(@Param("status") CardStatementImportStatus status,
                                                     @Param("now") Instant now, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        select i from CardStatementImport i
        where i.deletedAt is null
          and i.status = :status
          and i.processingStartedAt < :cutoff
        """)
    List<CardStatementImport> findStaleProcessingForUpdate(@Param("status") CardStatementImportStatus status,
                                                           @Param("cutoff") Instant cutoff);

    @Query("""
        select i from CardStatementImport i
        where i.status in :statuses
          and i.retentionUntil is not null
          and i.retentionUntil <= :now
          and i.storagePurgedAt is null
        """)
    List<CardStatementImport> findExpired(@Param("statuses") Collection<CardStatementImportStatus> statuses,
                                          @Param("now") Instant now, Pageable pageable);
}
