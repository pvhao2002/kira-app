package com.kira.bank.investment.infrastructure;

import com.kira.bank.investment.domain.InvestmentImportFileStatus;
import com.kira.bank.investment.domain.InvestmentTransactionImportFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface InvestmentTransactionImportFileRepository extends JpaRepository<InvestmentTransactionImportFile, Long> {
    List<InvestmentTransactionImportFile> findByBatchIdAndDeletedAtIsNullOrderById(Long batchId);
    Optional<InvestmentTransactionImportFile> findByBatchIdAndAttachmentIdAndDeletedAtIsNull(Long batchId, Long attachmentId);
    List<InvestmentTransactionImportFile> findByAttachmentIdAndStatusInAndDeletedAtIsNull(
        Long attachmentId, Collection<InvestmentImportFileStatus> statuses);

    @Query("""
        select count(f) from InvestmentTransactionImportFile f, InvestmentTransactionImportBatch b
        where f.batchId = b.id and f.attachmentId = :attachmentId and f.deletedAt is null and b.deletedAt is null
          and (b.retentionUntil is null or b.retentionUntil > :now)
        """)
    long countUnexpiredBatchLinks(@Param("attachmentId") Long attachmentId, @Param("now") Instant now);
}
