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
import java.util.UUID;

@Entity
@Immutable
@Table(name = "prediction_stats")
@Getter
@Setter
public class PredictionStats {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "prediction_id", nullable = false)
    private UUID predictionId;
    @Column(name = "possession_home")
    private BigDecimal possessionHome;
    @Column(name = "possession_away")
    private BigDecimal possessionAway;
    @Column(name = "shots_home")
    private Integer shotsHome;
    @Column(name = "shots_away")
    private Integer shotsAway;
    @Column(name = "shots_on_target_home")
    private Integer shotsOnTargetHome;
    @Column(name = "shots_on_target_away")
    private Integer shotsOnTargetAway;
    @Column(name = "shots_off_target_home")
    private Integer shotsOffTargetHome;
    @Column(name = "shots_off_target_away")
    private Integer shotsOffTargetAway;
    @Column(name = "corners_home")
    private Integer cornersHome;
    @Column(name = "corners_away")
    private Integer cornersAway;
    @Column(name = "yellow_cards_home")
    private Integer yellowCardsHome;
    @Column(name = "yellow_cards_away")
    private Integer yellowCardsAway;
    @Column(name = "red_cards_home")
    private Integer redCardsHome;
    @Column(name = "red_cards_away")
    private Integer redCardsAway;
    @JdbcTypeCode(SqlTypes.JSON)
    private JsonNode extra;
}
