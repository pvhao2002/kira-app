package com.kira.farm.inventory.infrastructure;

import com.kira.farm.inventory.domain.InventoryMovement;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;

public interface InventoryMovementRepository extends JpaRepository<InventoryMovement, Long> {
    Page<InventoryMovement> findByBranchIdInOrderByIdDesc(Collection<Long> branchIds, Pageable pageable);

    Page<InventoryMovement> findByBranchIdInAndProductIdOrderByIdDesc(Collection<Long> branchIds, Long productId,
                                                                      Pageable pageable);
}
