package com.kira.bank.lodging.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;

@Getter @Setter @Entity @Table(name = "lodging_reference_locations")
public class LodgingReferenceLocation extends AuditedEntity {
    @Column(nullable = false, length = 150) private String name;
    @Column(nullable = false, length = 500) private String address;
    @Column(length = 500) private String formattedAddress;
    @Column(length = 255) private String mapboxId;
    @Column(precision = 10, scale = 7) private BigDecimal longitude;
    @Column(precision = 10, scale = 7) private BigDecimal latitude;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private LodgingStatus geocodeStatus = LodgingStatus.PENDING;
    @Column(length = 80) private String geocodeError;
}
