package com.matchmind.prediction;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Immutable
@Table(name = "prediction_odds")
@Getter
@Setter
public class PredictionOdds {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "prediction_id", nullable = false)
    private UUID predictionId;
    @Column(name = "odds_ref", nullable = false)
    private String oddsRef;
    @Column(nullable = false)
    private String market;
    @Column(name = "odds_stage", nullable = false)
    private String oddsStage;
    @Column(name = "snapshot_order", nullable = false)
    private int snapshotOrder;
    private BigDecimal line;
    @Column(name = "line_display")
    private String lineDisplay;
    @Column(name = "home_odds")
    private BigDecimal homeOdds;
    @Column(name = "away_odds")
    private BigDecimal awayOdds;
    @Column(name = "draw_odds")
    private BigDecimal drawOdds;
    @Column(name = "over_odds")
    private BigDecimal overOdds;
    @Column(name = "under_odds")
    private BigDecimal underOdds;
    @Column(name = "settlement_basis", nullable = false)
    private String settlementBasis;
    @Column(name = "home_score_at_capture")
    private Integer homeScoreAtCapture;
    @Column(name = "away_score_at_capture")
    private Integer awayScoreAtCapture;
    @Column(name = "home_corners_at_capture")
    private Integer homeCornersAtCapture;
    @Column(name = "away_corners_at_capture")
    private Integer awayCornersAtCapture;
    @Column(name = "captured_at")
    private Instant capturedAt;
    @JdbcTypeCode(SqlTypes.JSON)
    private JsonNode extra;

    /** Decimal price of a selection on this snapshot (null when the snapshot has no such price). */
    public BigDecimal priceOf(String pick) {
        return switch (pick) {
            case "HOME" -> homeOdds;
            case "AWAY" -> awayOdds;
            case "DRAW" -> drawOdds;
            case "OVER" -> overOdds;
            case "UNDER" -> underOdds;
            default -> null;
        };
    }
}
