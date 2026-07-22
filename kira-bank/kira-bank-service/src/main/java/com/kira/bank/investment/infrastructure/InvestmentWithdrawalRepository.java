package com.kira.bank.investment.infrastructure;

import com.kira.bank.investment.domain.InvestmentWithdrawal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.*;

import java.util.Optional;

public interface InvestmentWithdrawalRepository extends JpaRepository<InvestmentWithdrawal, Long> {
    Optional<InvestmentWithdrawal> findByIdAndUserIdAndDeletedAtIsNull(Long id, Long userId);

    Optional<InvestmentWithdrawal> findByUserIdAndIdempotencyKey(Long userId, String key);

    Page<InvestmentWithdrawal> findByUserIdAndDeletedAtIsNull(Long userId, Pageable p);
}
