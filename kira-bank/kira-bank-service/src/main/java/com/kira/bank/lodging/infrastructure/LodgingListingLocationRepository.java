package com.kira.bank.lodging.infrastructure;

import com.kira.bank.lodging.domain.LodgingListingLocation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.Set;

public interface LodgingListingLocationRepository extends JpaRepository<LodgingListingLocation, Long> {
    List<LodgingListingLocation> findByListingIdAndDeletedAtIsNull(Long listingId);

    List<LodgingListingLocation> findByListingIdInAndDeletedAtIsNull(Collection<Long> listingIds);

    boolean existsByReferenceLocationIdAndDeletedAtIsNull(Long referenceLocationId);

    @Query("select distinct l.referenceLocationId from LodgingListingLocation l where l.deletedAt is null")
    Set<Long> activeReferenceLocationIds();
}
