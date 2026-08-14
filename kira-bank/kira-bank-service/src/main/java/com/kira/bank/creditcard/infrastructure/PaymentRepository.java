package com.kira.bank.creditcard.infrastructure;

import com.kira.bank.creditcard.domain.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.*;

import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    Optional<Payment> findByUserIdAndIdempotencyKey(Long userId, String key);

    boolean existsByStatementIdAndDeletedAtIsNull(Long statementId);

    Page<Payment> findByUserIdAndDeletedAtIsNull(Long userId, Pageable p);
}
