package com.kira.bank.creditcard.infrastructure;

import com.kira.bank.creditcard.domain.Statement;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface StatementRepository extends JpaRepository<Statement, Long> {
    Optional<Statement> findByIdAndUserIdAndDeletedAtIsNull(Long id, Long userId);

    Page<Statement> findByUserIdAndDeletedAtIsNull(Long userId, Pageable p);
}

