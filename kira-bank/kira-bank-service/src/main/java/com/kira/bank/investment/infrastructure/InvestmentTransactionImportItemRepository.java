package com.kira.bank.investment.infrastructure;

import com.kira.bank.investment.domain.InvestmentProcessingAction;
import com.kira.bank.investment.domain.InvestmentTransactionImportItem;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface InvestmentTransactionImportItemRepository extends JpaRepository<InvestmentTransactionImportItem, Long> {
    List<InvestmentTransactionImportItem> findByBatchIdAndDeletedAtIsNullOrderById(Long batchId);
    List<InvestmentTransactionImportItem> findByBatchIdAndPrimaryAttachmentIdAndDeletedAtIsNull(Long batchId, Long attachmentId);
    Optional<InvestmentTransactionImportItem> findByItemIdAndBatchIdAndDeletedAtIsNull(String itemId, Long batchId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from InvestmentTransactionImportItem i where i.itemId = :itemId and i.batchId = :batchId and i.deletedAt is null")
    Optional<InvestmentTransactionImportItem> findForUpdate(@Param("itemId") String itemId,
                                                             @Param("batchId") Long batchId);
    long countByBatchIdAndProcessingActionAndConfirmedTransactionIdIsNullAndDeletedAtIsNull(
        Long batchId, InvestmentProcessingAction action);
}
