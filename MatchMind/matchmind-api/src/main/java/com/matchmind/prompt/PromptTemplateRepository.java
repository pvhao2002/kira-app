package com.matchmind.prompt;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PromptTemplateRepository extends JpaRepository<PromptTemplate, UUID> {
    List<PromptTemplate> findAllByOrderByTemplateTypeAscNameAsc();

    boolean existsByName(String name);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from PromptTemplate t where t.id = ?1")
    Optional<PromptTemplate> lockById(UUID id);
}
