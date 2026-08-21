package com.kira.bank.lodging.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;

@Getter @Setter @Entity @Table(name = "lodging_listing_locations")
public class LodgingListingLocation extends AuditedEntity {
    @Column(nullable = false) private Long listingId;
    @Column(nullable = false) private Long referenceLocationId;
    private Long distanceMeters;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private LodgingStatus distanceStatus = LodgingStatus.PENDING;
    @Column(length = 80) private String distanceError;
    private Instant calculatedAt;
}
