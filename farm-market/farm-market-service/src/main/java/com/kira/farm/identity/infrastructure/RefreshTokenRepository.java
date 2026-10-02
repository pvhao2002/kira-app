package com.kira.farm.identity.infrastructure;

import com.kira.farm.identity.domain.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {
    Optional<RefreshToken> findByTokenHash(String tokenHash);

    List<RefreshToken> findByFamilyIdAndRevokedAtIsNull(String familyId);

    /** Revokes every live refresh token of the user (role change, password reset). Returns the rows touched.
     *  clearAutomatically detaches all entities: call this LAST in the transaction (after saveAndFlush). */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update RefreshToken t set t.revokedAt = :now where t.user.id = :userId and t.revokedAt is null")
    int revokeAllByUser(@Param("userId") Long userId, @Param("now") Instant now);

    /** Same, but keeps the session family the caller is using (password change). */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update RefreshToken t set t.revokedAt = :now where t.user.id = :userId and t.revokedAt is null "
        + "and t.familyId <> :keepFamily")
    int revokeOthersByUser(@Param("userId") Long userId, @Param("keepFamily") String keepFamily,
                           @Param("now") Instant now);
}
