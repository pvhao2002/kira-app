package kira.schema.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import kira.schema.entity.enums.PredictionPick;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(
        name = "event_prediction_score",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_event_prediction_score_rank",
                columnNames = {"event_prediction_id", "rank_no"}
        )
)
@Getter
@Setter
@NoArgsConstructor
public class EventPredictionScore {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "event_prediction_score_id")
    private Long eventPredictionScoreId;

    @Column(name = "event_prediction_id", nullable = false)
    private Long eventPredictionId;

    @Column(name = "rank_no", nullable = false)
    private Integer rankNo;

    @Column(name = "ft_goal_str", nullable = false, length = 10)
    private String ftGoalStr;

    @Column(name = "match_count", nullable = false)
    private Integer matchCount;

    @Enumerated(EnumType.STRING)
    @Column(name = "hdc_pick", nullable = false, columnDefinition = "enum('HOME','AWAY','OVER','UNDER','DRAW','NONE')")
    private PredictionPick hdcPick;

    @Enumerated(EnumType.STRING)
    @Column(name = "ou_pick", nullable = false, columnDefinition = "enum('HOME','AWAY','OVER','UNDER','DRAW','NONE')")
    private PredictionPick ouPick;
}
