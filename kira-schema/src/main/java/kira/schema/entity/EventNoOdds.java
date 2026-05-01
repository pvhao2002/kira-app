package kira.schema.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Events for which crawl found no usable odds (e.g. no Odds tab or no odds data persisted).
 */
@Entity
@Table(name = "event_no_odds")
@Getter
@Setter
@NoArgsConstructor
public class EventNoOdds {

    @Id
    @Column(name = "event_id")
    private Long eventId;

    @Column(name = "recorded_at", nullable = false)
    private LocalDateTime recordedAt;
}
