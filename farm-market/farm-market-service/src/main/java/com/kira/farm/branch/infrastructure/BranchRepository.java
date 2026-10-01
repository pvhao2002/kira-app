package com.kira.farm.branch.infrastructure;

import com.kira.farm.branch.domain.Branch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BranchRepository extends JpaRepository<Branch, Long> {
    List<Branch> findAllByOrderByIdAsc();

    List<Branch> findByIdInOrderByIdAsc(java.util.Collection<Long> ids);

    Optional<Branch> findByCode(String code);
}
