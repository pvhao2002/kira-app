package com.kira.farm.catalog.infrastructure;

import com.kira.farm.catalog.domain.ProductGroup;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ProductGroupRepository extends JpaRepository<ProductGroup, Long> {
    Optional<ProductGroup> findByCode(String code);
}
