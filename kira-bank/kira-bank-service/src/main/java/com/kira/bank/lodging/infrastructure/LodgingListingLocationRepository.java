package com.kira.bank.lodging.infrastructure;

import com.kira.bank.lodging.domain.LodgingListingLocation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Collection;
import java.util.List;

public interface LodgingListingLocationRepository extends JpaRepository<LodgingListingLocation, Long> {
    List<LodgingListingLocation> findByListingIdAndDeletedAtIsNull(Long listingId);
    List<LodgingListingLocation> findByListingIdInAndDeletedAtIsNull(Collection<Long> listingIds);
    boolean existsByReferenceLocationIdAndDeletedAtIsNull(Long referenceLocationId);
}
