package com.kira.bank.creditcard.infrastructure;
import com.kira.bank.creditcard.domain.DiscountInvoice;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface DiscountInvoiceRepository extends JpaRepository<DiscountInvoice,Long>{Page<DiscountInvoice>findByUserIdAndDeletedAtIsNull(Long userId,Pageable p);}

