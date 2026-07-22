package com.kira.bank.publiccatalog.infrastructure;

import com.kira.bank.publiccatalog.domain.Bank;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BankRepository extends JpaRepository<Bank, Long> {
    Page<Bank> findByActiveTrueAndNameContainingIgnoreCase(String search, Pageable pageable);
}

