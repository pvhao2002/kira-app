package com.kira.bank.investment.infrastructure;

import com.kira.bank.investment.domain.InvestmentTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.*;

import java.util.Optional;

public interface InvestmentTaskRepository extends JpaRepository<InvestmentTask, Long> {
    Optional<InvestmentTask> findByIdAndUserIdAndDeletedAtIsNull(Long id, Long userId);

    Optional<InvestmentTask> findByUserIdAndIdempotencyKey(Long userId, String key);

    Page<InvestmentTask> findByUserIdAndDeletedAtIsNull(Long userId, Pageable p);
}
