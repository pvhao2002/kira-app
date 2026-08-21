package com.kira.bank.lodging.infrastructure;

import com.kira.bank.lodging.domain.LodgingReferenceLocation;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface LodgingReferenceLocationRepository extends JpaRepository<LodgingReferenceLocation, Long> {
    List<LodgingReferenceLocation> findByDeletedAtIsNull(Sort sort);
    Optional<LodgingReferenceLocation> findByIdAndDeletedAtIsNull(Long id);
}
