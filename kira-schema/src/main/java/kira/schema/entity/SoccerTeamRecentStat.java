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
import kira.schema.entity.enums.SoccerTeamRecentStatMetric;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "soccer_team_recent_stat",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_strs_metric_team_window",
                columnNames = {"metric_type", "team_id", "window_end"}
        ),
        indexes = {
                @Index(name = "idx_strs_metric_rank", columnList = "metric_type, rank_no"),
                @Index(name = "idx_strs_window_metric_rank", columnList = "window_end, metric_type, rank_no"),
                @Index(name = "idx_strs_computed_at", columnList = "computed_at")
        })
@Getter
@Setter
@NoArgsConstructor
public class SoccerTeamRecentStat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "stat_id")
    private Long statId;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "metric_type",
            nullable = false,
            columnDefinition = "enum('TOTAL_GOALS_3_PLUS','TOTAL_CORNERS_10_PLUS','FIRST_HALF_GOAL')")
    private SoccerTeamRecentStatMetric metricType;

    @Column(name = "team_id", nullable = false)
    private Integer teamId;

    @Column(name = "team_name", nullable = false, length = 100)
    private String teamName;

    @Column(name = "window_start", nullable = false)
    private LocalDate windowStart;

    @Column(name = "window_end", nullable = false)
    private LocalDate windowEnd;

    @Column(name = "eligible_match_count", nullable = false)
    private Integer eligibleMatchCount;

    @Column(name = "matched_match_count", nullable = false)
    private Integer matchedMatchCount;

    @Column(name = "percentage", nullable = false, precision = 6, scale = 2)
    private BigDecimal percentage;

    @Column(name = "rank_no", nullable = false)
    private Integer rankNo;

    @Column(name = "computed_at", nullable = false, columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime computedAt;

    @Column(name = "created_at", columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt;

    @Column(name = "updated_at", columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
    private LocalDateTime updatedAt;
}
