package com.kira.bank.lodging.infrastructure;

import com.kira.bank.lodging.domain.LodgingListing;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface LodgingListingRepository extends JpaRepository<LodgingListing, Long> {
    @Query("select l from LodgingListing l where l.deletedAt is null and " +
        "(:search = '' or lower(l.address) like lower(concat('%', :search, '%')) or " +
        "lower(coalesce(l.note, '')) like lower(concat('%', :search, '%')) or coalesce(l.phone, '') like concat('%', :search, '%'))")
    Page<LodgingListing> search(@Param("search") String search, Pageable pageable);
    Optional<LodgingListing> findByIdAndDeletedAtIsNull(Long id);
}
