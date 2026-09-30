package com.kira.bank.creditcard.infrastructure;

import com.kira.bank.creditcard.domain.CardTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface CardTransactionRepository extends JpaRepository<CardTransaction, Long> {
    Optional<CardTransaction> findByIdAndUserIdAndDeletedAtIsNull(Long id, Long userId);

    Optional<CardTransaction> findByUserCardIdAndDedupKey(Long userCardId, byte[] dedupKey);

    @Query("""
        select t from CardTransaction t
        where t.userId = :userId
          and t.userCardId = :cardId
          and t.deletedAt is null
          and (:fromDate is null or t.transactionDate >= :fromDate)
          and (:toDate is null or t.transactionDate <= :toDate)
        """)
    Page<CardTransaction> search(@Param("userId") Long userId, @Param("cardId") Long cardId,
                                 @Param("fromDate") LocalDate fromDate, @Param("toDate") LocalDate toDate,
                                 Pageable pageable);

    List<CardTransaction> findByUserCardIdInAndTransactionDateBetweenAndDeletedAtIsNull(
        Collection<Long> cardIds, LocalDate fromDate, LocalDate toDate);

    List<CardTransaction> findByStatementIdAndDeletedAtIsNull(Long statementId);

    List<CardTransaction> findByUserCardIdInAndStatementIdIsNullAndTransactionDateGreaterThanEqualAndDeletedAtIsNull(
        Collection<Long> cardIds, LocalDate fromDate);
}
