package com.kira.farm.identity.infrastructure;

import com.kira.farm.identity.domain.PasswordResetToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

// ponytail: used/expired rows of users who never reset again are never swept; add a @Scheduled deleteByExpiresAtBefore when the table grows.
public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {
    Optional<PasswordResetToken> findByTokenHash(String tokenHash);

    /** Only the newest token per user stays valid. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from PasswordResetToken t where t.userId = :userId")
    int deleteByUserId(@Param("userId") Long userId);

    /** Conditional UPDATE: of two concurrent redemptions of one token exactly one gets 1, the other 0. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update PasswordResetToken t set t.usedAt = :now where t.id = :id and t.usedAt is null and t.expiresAt > :now")
    int markUsed(@Param("id") Long id, @Param("now") Instant now);
}
