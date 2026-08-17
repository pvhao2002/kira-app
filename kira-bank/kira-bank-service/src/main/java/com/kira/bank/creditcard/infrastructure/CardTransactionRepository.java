package com.kira.bank.creditcard.infrastructure;

import com.kira.bank.creditcard.domain.CardTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CardTransactionRepository extends JpaRepository<CardTransaction, Long> {
    Page<CardTransaction> findByUserIdAndDeletedAtIsNull(Long userId, Pageable p);

    boolean existsByUserIdAndUserCardIdAndReferenceNumber(Long u, Long c, String r);
}

