package com.kira.bank.lodging.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "lodging_listing_images")
public class LodgingListingImage extends AuditedEntity {
    @Column(nullable = false)
    private Long listingId;
    @Column(nullable = false)
    private Long attachmentId;
    @Column(nullable = false)
    private int sortOrder;
}
