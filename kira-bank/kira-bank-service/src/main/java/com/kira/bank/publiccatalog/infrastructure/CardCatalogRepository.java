package com.kira.bank.publiccatalog.infrastructure;
import com.kira.bank.publiccatalog.domain.CardCatalog;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
public interface CardCatalogRepository extends JpaRepository<CardCatalog,Long>{
 @EntityGraph(attributePaths="bank") Page<CardCatalog> findByActiveTrueAndCardNameContainingIgnoreCase(String search,Pageable pageable);
}

