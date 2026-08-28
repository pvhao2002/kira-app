package com.kira.bank.passwordvault.infrastructure;

import com.kira.bank.passwordvault.domain.PasswordVaultAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface PasswordVaultAccountRepository extends JpaRepository<PasswordVaultAccount, Long> {
    List<PasswordVaultAccount> findByOwnerIdAndModuleIdAndDeletedAtIsNullOrderByDisplayNameAscIdAsc(Long ownerId, Long moduleId);
    Optional<PasswordVaultAccount> findByIdAndOwnerIdAndDeletedAtIsNull(Long id, Long ownerId);
    long countByOwnerIdAndModuleIdAndDeletedAtIsNull(Long ownerId, Long moduleId);

    @Modifying
    @Query("update PasswordVaultAccount a set a.deletedAt = :deletedAt, a.updatedBy = :userId, a.version = a.version + 1 " +
        "where a.ownerId = :userId and a.moduleId = :moduleId and a.deletedAt is null")
    int softDeleteModuleAccounts(@Param("userId") Long userId, @Param("moduleId") Long moduleId,
                                 @Param("deletedAt") Instant deletedAt);
}
