package com.kira.bank.investment.infrastructure;
import com.kira.bank.investment.domain.InvestmentAccount;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
public interface InvestmentAccountRepository extends JpaRepository<InvestmentAccount,Long>{Optional<InvestmentAccount> findByIdAndUserIdAndDeletedAtIsNull(Long id,Long userId);Page<InvestmentAccount> findByUserIdAndDeletedAtIsNull(Long userId,Pageable p);}

