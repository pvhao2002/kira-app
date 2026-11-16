package com.kira.affiliate.shopee.infrastructure;

import com.kira.affiliate.shopee.domain.ShopeeCredential;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ShopeeCredentialRepository extends JpaRepository<ShopeeCredential, Long> {
    Optional<ShopeeCredential> findByUserId(Long userId);

    long deleteByUserId(Long userId);

    @Query("select c.userId from ShopeeCredential c order by c.userId")
    List<Long> findUserIds();
}
