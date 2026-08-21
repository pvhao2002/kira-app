package com.kira.bank.lodging.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;

@Getter @Setter @Entity @Table(name = "lodging_listings")
public class LodgingListing extends AuditedEntity {
    @Column(nullable = false) private Long ownerId;
    @Column(nullable = false, length = 500) private String address;
    @Column(length = 500) private String formattedAddress;
    @Column(length = 255) private String mapboxId;
    @Column(precision = 10, scale = 7) private BigDecimal longitude;
    @Column(precision = 10, scale = 7) private BigDecimal latitude;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private LodgingStatus geocodeStatus = LodgingStatus.PENDING;
    @Column(length = 80) private String geocodeError;
    @Column(nullable = false, precision = 19, scale = 4) private BigDecimal rentPrice;
    @Column(precision = 19, scale = 4) private BigDecimal electricityPrice;
    @Column(length = 30) private String electricityUnit;
    @Column(precision = 19, scale = 4) private BigDecimal waterPrice;
    @Column(length = 30) private String waterUnit;
    @Column(precision = 19, scale = 4) private BigDecimal servicePrice;
    @Column(length = 30) private String serviceUnit;
    @Column(precision = 19, scale = 4) private BigDecimal parkingPrice;
    @Column(length = 30) private String parkingUnit;
    @Column(length = 1000) private String facebookUrl;
    @Column(length = 30) private String phone;
    @Column(length = 1000) private String videoUrl;
    @Column(columnDefinition = "TEXT") private String note;
}
