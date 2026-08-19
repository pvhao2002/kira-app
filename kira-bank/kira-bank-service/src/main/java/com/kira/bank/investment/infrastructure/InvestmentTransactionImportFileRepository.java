package com.kira.bank.investment.infrastructure;

import com.kira.bank.investment.domain.InvestmentImportFileStatus;
import com.kira.bank.investment.domain.InvestmentImportBatchStatus;
import com.kira.bank.investment.domain.InvestmentImportResolution;
import com.kira.bank.investment.domain.InvestmentTransactionImportFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface InvestmentTransactionImportFileRepository extends JpaRepository<InvestmentTransactionImportFile, Long> {
    interface AiJobReviewTargetProjection {
        Long getAttachmentId();
        Long getAccountId();
        String getAccountName();
        String getBatchId();
        InvestmentImportBatchStatus getBatchStatus();
        Instant getCreatedAt();
        long getPendingItemCount();
    }

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

    @Query("""
        select f.attachmentId as attachmentId,
               b.investmentAccountId as accountId,
               account.accountName as accountName,
               b.batchId as batchId,
               b.status as batchStatus,
               b.createdAt as createdAt,
               count(item.id) as pendingItemCount
        from InvestmentTransactionImportFile f,
             InvestmentTransactionImportBatch b,
             InvestmentTransactionImportItem item,
             InvestmentAccount account,
             Attachment attachment
        where f.attachmentId in :attachmentIds
          and f.batchId = b.id
          and item.batchId = b.id
          and account.id = b.investmentAccountId
          and account.userId = b.userId
          and attachment.id = f.attachmentId
          and attachment.userId = b.userId
          and b.status in :batchStatuses
          and item.confirmedTransactionId is null
          and (item.resolution is null or item.resolution <> :skippedResolution)
          and f.deletedAt is null
          and b.deletedAt is null
          and item.deletedAt is null
          and account.deletedAt is null
          and attachment.deletedAt is null
        group by f.attachmentId, b.investmentAccountId, account.accountName,
                 b.batchId, b.status, b.createdAt
        order by b.createdAt desc
        """)
    List<AiJobReviewTargetProjection> findAiJobReviewTargets(
        @Param("attachmentIds") Collection<Long> attachmentIds,
        @Param("batchStatuses") Collection<InvestmentImportBatchStatus> batchStatuses,
        @Param("skippedResolution") InvestmentImportResolution skippedResolution
    );
}
