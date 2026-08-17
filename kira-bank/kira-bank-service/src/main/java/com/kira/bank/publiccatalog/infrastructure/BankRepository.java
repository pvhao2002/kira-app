package com.kira.bank.publiccatalog.infrastructure;

import com.kira.bank.publiccatalog.domain.Bank;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BankRepository extends JpaRepository<Bank, Long> {
    @Query("""
        select b from Bank b
        where b.active = true
          and b.deletedAt is null
          and (:search = ''
            or lower(b.name) like lower(concat('%', :search, '%'))
            or lower(b.shortName) like lower(concat('%', :search, '%'))
            or lower(b.code) like lower(concat('%', :search, '%')))
        """)
    Page<Bank> search(@Param("search") String search, Pageable pageable);
}
