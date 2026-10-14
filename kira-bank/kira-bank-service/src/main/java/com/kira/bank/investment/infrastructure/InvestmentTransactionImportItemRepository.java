package com.kira.bank.investment.infrastructure;

import com.kira.bank.investment.domain.InvestmentTransactionImportItem;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface InvestmentTransactionImportItemRepository extends JpaRepository<InvestmentTransactionImportItem, Long> {
    @Query("""
        select i from InvestmentTransactionImportItem i
        where i.investmentAccountId = :accountId and i.confirmedTransactionId is null and i.deletedAt is null
          and (i.resolution is null or i.resolution <> com.kira.bank.investment.domain.InvestmentImportResolution.SKIP)
        order by i.id
        """)
    List<InvestmentTransactionImportItem> findOpenByAccount(@Param("accountId") Long accountId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from InvestmentTransactionImportItem i where i.itemId = :itemId and i.investmentAccountId = :accountId and i.deletedAt is null")
    Optional<InvestmentTransactionImportItem> findForUpdate(@Param("itemId") String itemId,
                                                            @Param("accountId") Long accountId);

    List<InvestmentTransactionImportItem> findByPrimaryAttachmentIdAndConfirmedTransactionIdIsNullAndDeletedAtIsNull(
        Long attachmentId);
}
