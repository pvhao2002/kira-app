package com.kira.bank.publiccatalog.infrastructure;

import com.kira.bank.publiccatalog.domain.Mcc;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;

public interface MccRepository extends JpaRepository<Mcc, Long> {
    @Query("select m from Mcc m where m.active=true and (:search='' or lower(m.name) like lower(concat('%',:search,'%')) or m.code like concat('%',:search,'%')) and (:category='' or m.category=:category)")
    Page<Mcc> search(String search, String category, Pageable pageable);
}

