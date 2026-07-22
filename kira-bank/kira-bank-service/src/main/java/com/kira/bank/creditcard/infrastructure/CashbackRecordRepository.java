package com.kira.bank.creditcard.infrastructure;

import com.kira.bank.creditcard.domain.CashbackRecord;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CashbackRecordRepository extends JpaRepository<CashbackRecord, Long> {
    Page<CashbackRecord> findByUserIdAndDeletedAtIsNull(Long user, Pageable p);
}
