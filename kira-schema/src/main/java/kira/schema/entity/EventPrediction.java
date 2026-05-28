package kira.schema.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import kira.schema.entity.enums.EventPredictionStatus;
import kira.schema.entity.enums.PredictionPick;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "event_prediction",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_event_prediction_event_version",
                columnNames = {"event_id", "prediction_version_id"}
        ),
        indexes = @Index(name = "idx_event_prediction_version_status", columnList = "prediction_version_id, status")
)
@Getter
@Setter
@NoArgsConstructor
public class EventPrediction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "event_prediction_id")
    private Long eventPredictionId;

    @Column(name = "event_id", nullable = false)
    private Long eventId;

    @Column(name = "prediction_version_id", nullable = false)
    private Long predictionVersionId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "enum('pending','completed','skipped','failed')")
    private EventPredictionStatus status = EventPredictionStatus.pending;

    @Column(name = "prematch_hdc_line", length = 25)
    private String prematchHdcLine;

    @Column(name = "prematch_ou_line", length = 25)
    private String prematchOuLine;

    @Column(name = "prematch_hdc_price_a", precision = 10, scale = 2)
    private BigDecimal prematchHdcPriceA;

    @Column(name = "prematch_hdc_price_b", precision = 10, scale = 2)
    private BigDecimal prematchHdcPriceB;

    @Column(name = "prematch_ou_price_a", precision = 10, scale = 2)
    private BigDecimal prematchOuPriceA;

    @Column(name = "prematch_ou_price_b", precision = 10, scale = 2)
    private BigDecimal prematchOuPriceB;

    @Enumerated(EnumType.STRING)
    @Column(name = "hdc_pick", columnDefinition = "enum('HOME','AWAY','OVER','UNDER','DRAW','NONE')")
    private PredictionPick hdcPick;

    @Enumerated(EnumType.STRING)
    @Column(name = "ou_pick", columnDefinition = "enum('HOME','AWAY','OVER','UNDER','DRAW','NONE')")
    private PredictionPick ouPick;

    @Column(name = "hdc_vote_count")
    private Integer hdcVoteCount;

    @Column(name = "ou_vote_count")
    private Integer ouVoteCount;

    @Column(name = "match_sample_count")
    private Integer matchSampleCount;

    @Column(name = "error_message", length = 512)
    private String errorMessage;

    @Column(name = "created_at", columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt;

    @Column(name = "updated_at", columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
    private LocalDateTime updatedAt;
}
