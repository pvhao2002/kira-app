package com.kira.bank.investment.infrastructure;

import com.kira.bank.investment.domain.InvestmentAccount;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface InvestmentAccountRepository extends JpaRepository<InvestmentAccount, Long> {
    Optional<InvestmentAccount> findByIdAndUserIdAndDeletedAtIsNull(Long id, Long userId);

    Page<InvestmentAccount> findByUserIdAndDeletedAtIsNull(Long userId, Pageable p);

    @Query("""
        select a from InvestmentAccount a
        where a.userId = :userId
          and a.deletedAt is null
          and (:search = ''
            or lower(a.accountCode) like lower(concat('%', :search, '%'))
            or lower(a.accountName) like lower(concat('%', :search, '%'))
            or lower(a.accountUsername) like lower(concat('%', :search, '%'))
            or lower(a.accountEmail) like lower(concat('%', :search, '%')))
        """)
    Page<InvestmentAccount> search(@Param("userId") Long userId, @Param("search") String search, Pageable p);
}
