package com.matchmind.match;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "matches")
@Getter
@Setter
public class Match {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "provider_id", nullable = false, updatable = false)
    private UUID providerId;
    @Column(name = "external_match_id", nullable = false, updatable = false)
    private String externalMatchId;
    @Column(nullable = false)
    private String league;
    @Column(name = "home_team", nullable = false)
    private String homeTeam;
    @Column(name = "away_team", nullable = false)
    private String awayTeam;
    @Column(name = "start_time", nullable = false)
    private Instant startTime;
    @Column(nullable = false)
    private String status = "SCHEDULED";
    @Column(name = "final_home_score")
    private Integer finalHomeScore;
    @Column(name = "final_away_score")
    private Integer finalAwayScore;
    @Column(name = "final_home_corners")
    private Integer finalHomeCorners;
    @Column(name = "final_away_corners")
    private Integer finalAwayCorners;
    @Column(name = "ht_home_score")
    private Integer htHomeScore;
    @Column(name = "ht_away_score")
    private Integer htAwayScore;
    @Column(name = "ht_home_corners")
    private Integer htHomeCorners;
    @Column(name = "ht_away_corners")
    private Integer htAwayCorners;
    @Column(name = "result_updated_at")
    private Instant resultUpdatedAt;
    /** Read-only here: only {@link FixtureService} moves it (JDBC + fixture_link_history), so a save never clobbers it. */
    @Column(name = "fixture_id", insertable = false, updatable = false)
    private UUID fixtureId;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = updatedAt = Instant.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    /** Snapshot of the result fields, used for the audit trail. */
    public Map<String, Object> resultSnapshot() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("status", status);
        m.put("finalHomeScore", finalHomeScore);
        m.put("finalAwayScore", finalAwayScore);
        m.put("finalHomeCorners", finalHomeCorners);
        m.put("finalAwayCorners", finalAwayCorners);
        m.put("htHomeScore", htHomeScore);
        m.put("htAwayScore", htAwayScore);
        m.put("htHomeCorners", htHomeCorners);
        m.put("htAwayCorners", htAwayCorners);
        return m;
    }
}
