package com.kira.bank.passwordvault.infrastructure;

import com.kira.bank.passwordvault.domain.PasswordVaultUnlockSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface PasswordVaultUnlockSessionRepository extends JpaRepository<PasswordVaultUnlockSession, Long> {
    Optional<PasswordVaultUnlockSession> findByTokenHashAndUserIdAndRevokedAtIsNull(String tokenHash, Long userId);

    @Modifying
    @Query("update PasswordVaultUnlockSession s set s.revokedAt = :now where s.userId = :userId and s.revokedAt is null")
    int revokeForUser(@Param("userId") Long userId, @Param("now") Instant now);
}
