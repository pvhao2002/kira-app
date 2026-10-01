package com.kira.farm.loyalty.infrastructure;

import com.kira.farm.loyalty.domain.LoyaltyEntry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;

public interface LoyaltyRepository extends JpaRepository<LoyaltyEntry, Long> {
    /** Idempotent earn: returns 0 when (ref_type, ref_id, reason) was already recorded. */
    @Modifying(flushAutomatically = true)
    @Query(value = "INSERT IGNORE INTO loyalty_ledger (user_id, delta, reason, ref_type, ref_id, expires_at, created_at) "
        + "VALUES (:userId, :delta, :reason, :refType, :refId, :expiresAt, UTC_TIMESTAMP(6))", nativeQuery = true)
    int insertExpiring(@Param("userId") Long userId, @Param("delta") int delta, @Param("reason") String reason,
                       @Param("refType") String refType, @Param("refId") String refId,
                       @Param("expiresAt") Instant expiresAt);

    /** Idempotent spend row (never expires). */
    @Modifying(flushAutomatically = true)
    @Query(value = "INSERT IGNORE INTO loyalty_ledger (user_id, delta, reason, ref_type, ref_id, expires_at, created_at) "
        + "VALUES (:userId, :delta, :reason, :refType, :refId, NULL, UTC_TIMESTAMP(6))", nativeQuery = true)
    int insertPermanent(@Param("userId") Long userId, @Param("delta") int delta, @Param("reason") String reason,
                        @Param("refType") String refType, @Param("refId") String refId);

    @Query("select coalesce(sum(e.delta), 0L) from LoyaltyEntry e where e.userId = :userId "
        + "and (e.expiresAt is null or e.expiresAt > :now)")
    long balance(@Param("userId") Long userId, @Param("now") Instant now);

    @Query("select coalesce(sum(e.delta), 0L) from LoyaltyEntry e where e.userId = :userId and e.delta > 0 "
        + "and e.reason <> 'ORDER_CANCEL_REFUND' and e.createdAt >= :since")
    long earnedSince(@Param("userId") Long userId, @Param("since") Instant since);

    @Query("select coalesce(sum(e.delta), 0L) from LoyaltyEntry e where e.userId = :userId and e.delta > 0 "
        + "and e.expiresAt > :now and e.expiresAt <= :until")
    long expiringBetween(@Param("userId") Long userId, @Param("now") Instant now, @Param("until") Instant until);

    @Query("select min(e.expiresAt) from LoyaltyEntry e where e.userId = :userId and e.delta > 0 "
        + "and e.expiresAt > :now and e.expiresAt <= :until")
    Instant firstExpiry(@Param("userId") Long userId, @Param("now") Instant now, @Param("until") Instant until);

    Page<LoyaltyEntry> findByUserIdOrderByIdDesc(Long userId, Pageable pageable);

    Page<LoyaltyEntry> findByUserIdAndDeltaGreaterThanOrderByIdDesc(Long userId, int delta, Pageable pageable);

    Page<LoyaltyEntry> findByUserIdAndDeltaLessThanOrderByIdDesc(Long userId, int delta, Pageable pageable);
}
