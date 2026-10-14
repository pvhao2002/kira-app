package com.kira.bank.storage.infrastructure;

import com.kira.bank.storage.domain.StoredFile;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface StoredFileRepository extends JpaRepository<StoredFile, Long> {
    Page<StoredFile> findByDeletedAtIsNullOrderByCreatedAtDesc(Pageable pageable);

    Optional<StoredFile> findByIdAndDeletedAtIsNull(Long id);
}
