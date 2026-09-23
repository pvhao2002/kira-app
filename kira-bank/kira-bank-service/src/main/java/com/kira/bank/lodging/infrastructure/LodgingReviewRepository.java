package com.kira.bank.lodging.infrastructure;

import com.kira.bank.lodging.domain.LodgingReview;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface LodgingReviewRepository extends JpaRepository<LodgingReview, Long> {
    List<LodgingReview> findByListingIdAndDeletedAtIsNullOrderByUpdatedAtDesc(Long listingId);

    List<LodgingReview> findByListingIdInAndDeletedAtIsNullOrderByUpdatedAtDesc(Collection<Long> listingIds);

    Optional<LodgingReview> findByListingIdAndUserIdAndDeletedAtIsNull(Long listingId, Long userId);
}
