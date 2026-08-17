package com.kira.bank.investment.infrastructure;

import com.kira.bank.investment.domain.InvestmentTask;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface InvestmentTaskRepository extends JpaRepository<InvestmentTask, Long> {
    Optional<InvestmentTask> findByIdAndUserIdAndDeletedAtIsNull(Long id, Long userId);

    Optional<InvestmentTask> findByUserIdAndIdempotencyKey(Long userId, String key);

    Page<InvestmentTask> findByUserIdAndDeletedAtIsNull(Long userId, Pageable p);
}
