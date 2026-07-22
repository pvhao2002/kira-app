package com.kira.bank.publiccatalog.infrastructure;
import com.kira.bank.publiccatalog.domain.CashbackRule;
import org.springframework.data.jpa.repository.*;
import java.time.LocalDate;
import java.util.List;
public interface CashbackRuleRepository extends JpaRepository<CashbackRule,Long>{
 @EntityGraph(attributePaths={"cardCatalog","cardCatalog.bank","mcc"})
 @Query("select r from CashbackRule r where r.active=true and r.mcc.id=:mccId and r.effectiveFrom<=:today and (r.effectiveTo is null or r.effectiveTo>=:today)")
 List<CashbackRule> findCurrent(long mccId, LocalDate today);
}

