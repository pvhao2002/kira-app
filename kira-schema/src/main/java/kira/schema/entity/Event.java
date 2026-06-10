package kira.schema.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "events",
        indexes = {
                @Index(name = "idx_event_date", columnList = "event_date"),
                @Index(name = "idx_events_status_date_id", columnList = "status, event_date, event_id"),
                @Index(name = "idx_events_date_home", columnList = "event_date, home_id"),
                @Index(name = "idx_events_date_away", columnList = "event_date, away_id"),
                @Index(name = "idx_event_date_event_name", columnList = "event_date, event_name"),
                @Index(name = "idx_league_date_name", columnList = "league_id, event_date, event_name"),
                @Index(name = "idx_home_away", columnList = "home_id, away_id")
        })
@Getter
@Setter
@NoArgsConstructor
public class Event {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "event_id")
    private Long eventId;

    @Column(name = "external_id", nullable = false, length = 100, unique = true)
    private String externalId;

    @Column(name = "league_id")
    private Integer leagueId;

    @Column(name = "home_id")
    private Integer homeId;

    @Column(name = "away_id")
    private Integer awayId;

    @Column(name = "event_name")
    private String eventName;

    @Column(name = "event_date", nullable = false)
    private LocalDateTime eventDate;

    @Column(length = 25)
    private String status = "-";

    @Column(name = "status_id")
    private Integer statusId;

    @Lob
    private String link;

    @Column(name = "has_odds")
    private Boolean hasOdds = false;

    @Column(name = "has_odds_corner")
    private Boolean hasOddsCorner = false;

    @Column(name = "created_at", columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt;

    @Column(name = "updated_at", columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
    private LocalDateTime updatedAt;
}
