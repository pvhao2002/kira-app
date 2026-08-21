package com.kira.bank.lodging.infrastructure;

import com.kira.bank.lodging.domain.LodgingListingImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.Optional;

public interface LodgingListingImageRepository extends JpaRepository<LodgingListingImage, Long> {
    List<LodgingListingImage> findByListingIdAndDeletedAtIsNullOrderBySortOrder(Long listingId);
    Optional<LodgingListingImage> findByListingIdAndAttachmentIdAndDeletedAtIsNull(Long listingId, Long attachmentId);
    long countByListingIdAndDeletedAtIsNull(Long listingId);
    @Query("select coalesce(max(i.sortOrder), -1) from LodgingListingImage i where i.listingId = :listingId and i.deletedAt is null")
    int maxActiveSortOrder(Long listingId);
}
