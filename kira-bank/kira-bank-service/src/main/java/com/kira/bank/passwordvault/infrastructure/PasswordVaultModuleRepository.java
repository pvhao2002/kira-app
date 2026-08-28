package com.kira.bank.passwordvault.infrastructure;

import com.kira.bank.passwordvault.domain.PasswordVaultModule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PasswordVaultModuleRepository extends JpaRepository<PasswordVaultModule, Long> {
    List<PasswordVaultModule> findByOwnerIdAndDeletedAtIsNullOrderByNameAscIdAsc(Long ownerId);
    Optional<PasswordVaultModule> findByIdAndOwnerIdAndDeletedAtIsNull(Long id, Long ownerId);
}
