package com.kira.bank.investment.infrastructure;
import com.kira.bank.investment.domain.TaskSettlement;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
public interface TaskSettlementRepository extends JpaRepository<TaskSettlement,Long>{Optional<TaskSettlement> findByUserIdAndIdempotencyKey(Long userId,String key);}

