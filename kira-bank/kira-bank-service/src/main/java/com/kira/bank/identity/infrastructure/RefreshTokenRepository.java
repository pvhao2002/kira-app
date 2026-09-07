package com.kira.bank.identity.infrastructure;

import com.kira.bank.identity.domain.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    Optional<RefreshToken> findByTokenHash(String hash);

    List<RefreshToken> findByFamilyIdAndRevokedAtIsNull(String familyId);
}
