package kira.schema.entity;

import jakarta.persistence.Column;
import jakarta.persistence.ConstraintMode;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "event_claim",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_event_claim_event_id",
                columnNames = "event_id"
        ),
        indexes = {
                @Index(name = "idx_claimed_by_claimed_at", columnList = "claimed_by, claimed_at"),
                @Index(name = "idx_claimed_at", columnList = "claimed_at"),
                @Index(name = "idx_event_claim_status_claimed_at", columnList = "status, claimed_at")
        })
@Getter
@Setter
@NoArgsConstructor
public class EventClaim {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "claim_id")
    private Long claimId;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id", nullable = false, foreignKey = @ForeignKey(ConstraintMode.NO_CONSTRAINT))
    private Event event;

    @Column(name = "claimed_by", nullable = false, length = 100)
    private String claimedBy;

    @Column(name = "claimed_at")
    private LocalDateTime claimedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private EventClaimStatus status = EventClaimStatus.processing;
}
