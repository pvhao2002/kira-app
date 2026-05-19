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
import kira.schema.entity.enums.IncidentType;
import kira.schema.entity.enums.TeamSide;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "event_incident",
        indexes = {
                @Index(name = "idx_event_id", columnList = "event_id"),
                @Index(name = "idx_event_type_minute", columnList = "event_id, incident_type, minute")
        })
@Getter
@Setter
@NoArgsConstructor
public class EventIncident {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "incident_id")
    private Long incidentId;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id", nullable = false, foreignKey = @ForeignKey(ConstraintMode.NO_CONSTRAINT))
    private Event event;

    @Enumerated(EnumType.STRING)
    @Column(name = "incident_type", nullable = false,
            columnDefinition = "enum('goal','yellow_card','red_card','second_yellow')")
    private IncidentType incidentType;

    @Column(nullable = false, columnDefinition = "smallint unsigned not null")
    private Integer minute;

    @Column(name = "minute_display", length = 10)
    private String minuteDisplay;

    @Column(columnDefinition = "enum('1st_half','2nd_half','extra_time_1','extra_time_2') default '1st_half'")
    private String period = "1st_half";

    @Enumerated(EnumType.STRING)
    @Column(name = "team_side", nullable = false, columnDefinition = "enum('home','away')")
    private TeamSide teamSide;

    @Column(name = "player_name", length = 100)
    private String playerName;

    @Column(name = "is_penalty")
    private Boolean isPenalty = Boolean.FALSE;

    @Column(name = "is_own_goal")
    private Boolean isOwnGoal = Boolean.FALSE;

    @Column(name = "created_at", columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt;

    @Column(name = "updated_at", columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
    private LocalDateTime updatedAt;
}
