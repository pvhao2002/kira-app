package com.kira.bank.creditcard.infrastructure;

import com.kira.bank.creditcard.domain.CardStatementImportFile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface CardStatementImportFileRepository extends JpaRepository<CardStatementImportFile, Long> {
    List<CardStatementImportFile> findByImportIdAndDeletedAtIsNullOrderByPageNumberAsc(Long importId);

    List<CardStatementImportFile> findByImportIdInAndDeletedAtIsNullOrderByPageNumberAsc(Collection<Long> importIds);
}
