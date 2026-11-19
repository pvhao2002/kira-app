package com.matchmind.provider;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ProviderRepository extends JpaRepository<Provider, UUID> {
    boolean existsByCode(String code);

    List<Provider> findAllByOrderByNameAsc();
}
