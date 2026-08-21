package com.kira.bank.ai.infrastructure;

import com.kira.bank.ai.domain.AiProviderAccount;
import com.kira.bank.ai.domain.AiProviderAccountStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface AiProviderAccountRepository extends JpaRepository<AiProviderAccount, Long> {
    List<AiProviderAccount> findByDeletedAtIsNullOrderByPriorityAscIdAsc();
    Optional<AiProviderAccount> findByIdAndDeletedAtIsNull(Long id);
    boolean existsByAccountIdAndDeletedAtIsNull(String accountId);
    boolean existsByAccountIdAndIdNotAndDeletedAtIsNull(String accountId, Long id);
    Optional<AiProviderAccount> findFirstByR2PrimaryTrueAndDeletedAtIsNull();

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update AiProviderAccount a set a.r2Primary = false where a.r2Primary = true and a.deletedAt is null")
    int clearR2Primary();

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
        update AiProviderAccount a set a.r2LastSuccessAt = :now, a.r2LastErrorCode = null,
            a.r2LastErrorAt = null
        where a.id = :id and a.deletedAt is null
        """)
    int markR2Success(@Param("id") Long id, @Param("now") Instant now);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
        update AiProviderAccount a set a.healthStatus = :status, a.cooldownUntil = null,
            a.lastErrorCode = null, a.lastErrorAt = null, a.lastSuccessAt = :now,
            a.updatedAt = :now, a.version = a.version + 1
        where a.id = :id and a.deletedAt is null
        """)
    int markSuccess(@Param("id") Long id, @Param("status") AiProviderAccountStatus status,
                    @Param("now") Instant now);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
        update AiProviderAccount a set a.healthStatus = :status, a.cooldownUntil = :cooldownUntil,
            a.lastErrorCode = :code, a.lastErrorAt = :now, a.updatedAt = :now,
            a.version = a.version + 1
        where a.id = :id and a.deletedAt is null
        """)
    int markFailure(@Param("id") Long id, @Param("status") AiProviderAccountStatus status,
                    @Param("cooldownUntil") Instant cooldownUntil, @Param("code") String code,
                    @Param("now") Instant now);
}
