package kira.schema.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import kira.schema.entity.enums.MatchOutcome;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "event_result")
@Getter
@Setter
@NoArgsConstructor
public class EventResult {

    @Id
    @Column(name = "event_id")
    private Long eventId;

    @Enumerated(EnumType.STRING)
    @Column(name = "ht_result", columnDefinition = "enum('H','D','A','None')")
    private MatchOutcome htResult;

    @Column(name = "ht_goal_str", length = 10)
    private String htGoalStr;

    @Enumerated(EnumType.STRING)
    @Column(name = "ft_result", columnDefinition = "enum('H','D','A','None')")
    private MatchOutcome ftResult;

    @Column(name = "ft_goal_str", length = 10)
    private String ftGoalStr;

    @Column(name = "ht_home_goal")
    private Integer htHomeGoal;

    @Column(name = "ht_away_goal")
    private Integer htAwayGoal;

    @Column(name = "ft_home_goal")
    private Integer ftHomeGoal;

    @Column(name = "ft_away_goal")
    private Integer ftAwayGoal;

    @Column(name = "ht_total_goal", columnDefinition = "tinyint unsigned generated always as (coalesce(ht_home_goal, 0) + coalesce(ht_away_goal, 0)) stored", insertable = false, updatable = false)
    private Integer htTotalGoal;

    @Column(name = "ft_total_goal", columnDefinition = "tinyint unsigned generated always as (coalesce(ft_home_goal, 0) + coalesce(ft_away_goal, 0)) stored", insertable = false, updatable = false)
    private Integer ftTotalGoal;

    @Column(name = "ht_home_corner")
    private Integer htHomeCorner;

    @Column(name = "ht_away_corner")
    private Integer htAwayCorner;

    @Column(name = "ft_home_corner")
    private Integer ftHomeCorner;

    @Column(name = "ft_away_corner")
    private Integer ftAwayCorner;

    @Column(name = "ht_total_corner", columnDefinition = "tinyint unsigned generated always as (coalesce(ht_home_corner, 0) + coalesce(ht_away_corner, 0)) stored", insertable = false, updatable = false)
    private Integer htTotalCorner;

    @Column(name = "ft_total_corner", columnDefinition = "tinyint unsigned generated always as (coalesce(ft_home_corner, 0) + coalesce(ft_away_corner, 0)) stored", insertable = false, updatable = false)
    private Integer ftTotalCorner;

    @Column(name = "ht_home_yellow_card")
    private Integer htHomeYellowCard;

    @Column(name = "ht_away_yellow_card")
    private Integer htAwayYellowCard;

    @Column(name = "ft_home_yellow_card")
    private Integer ftHomeYellowCard;

    @Column(name = "ft_away_yellow_card")
    private Integer ftAwayYellowCard;

    @Column(name = "ht_total_yellow_card", columnDefinition = "tinyint unsigned generated always as (coalesce(ht_home_yellow_card, 0) + coalesce(ht_away_yellow_card, 0)) stored", insertable = false, updatable = false)
    private Integer htTotalYellowCard;

    @Column(name = "ft_total_yellow_card", columnDefinition = "tinyint unsigned generated always as (coalesce(ft_home_yellow_card, 0) + coalesce(ft_away_yellow_card, 0)) stored", insertable = false, updatable = false)
    private Integer ftTotalYellowCard;

    @Column(name = "ht_home_foul")
    private Integer htHomeFoul;

    @Column(name = "ht_away_foul")
    private Integer htAwayFoul;

    @Column(name = "ft_home_foul")
    private Integer ftHomeFoul;

    @Column(name = "ft_away_foul")
    private Integer ftAwayFoul;

    @Column(name = "ht_total_foul", columnDefinition = "tinyint unsigned generated always as (coalesce(ht_home_foul, 0) + coalesce(ht_away_foul, 0)) stored", insertable = false, updatable = false)
    private Integer htTotalFoul;

    @Column(name = "ft_total_foul", columnDefinition = "tinyint unsigned generated always as (coalesce(ft_home_foul, 0) + coalesce(ft_away_foul, 0)) stored", insertable = false, updatable = false)
    private Integer ftTotalFoul;

    @Column(name = "ht_home_offside")
    private Integer htHomeOffside;

    @Column(name = "ht_away_offside")
    private Integer htAwayOffside;

    @Column(name = "ft_home_offside")
    private Integer ftHomeOffside;

    @Column(name = "ft_away_offside")
    private Integer ftAwayOffside;

    @Column(name = "ht_total_offside", columnDefinition = "tinyint unsigned generated always as (coalesce(ht_home_offside, 0) + coalesce(ht_away_offside, 0)) stored", insertable = false, updatable = false)
    private Integer htTotalOffside;

    @Column(name = "ft_total_offside", columnDefinition = "tinyint unsigned generated always as (coalesce(ft_home_offside, 0) + coalesce(ft_away_offside, 0)) stored", insertable = false, updatable = false)
    private Integer ftTotalOffside;

    @Column(name = "ht_home_total_shot")
    private Integer htHomeTotalShot;

    @Column(name = "ht_away_total_shot")
    private Integer htAwayTotalShot;

    @Column(name = "ft_home_total_shot")
    private Integer ftHomeTotalShot;

    @Column(name = "ft_away_total_shot")
    private Integer ftAwayTotalShot;

    @Column(name = "ht_total_shot", columnDefinition = "tinyint unsigned generated always as (coalesce(ht_home_total_shot, 0) + coalesce(ht_away_total_shot, 0)) stored", insertable = false, updatable = false)
    private Integer htTotalShot;

    @Column(name = "ft_total_shot", columnDefinition = "tinyint unsigned generated always as (coalesce(ft_home_total_shot, 0) + coalesce(ft_away_total_shot, 0)) stored", insertable = false, updatable = false)
    private Integer ftTotalShot;

    @Column(name = "ht_home_shot_on_target")
    private Integer htHomeShotOnTarget;

    @Column(name = "ht_away_shot_on_target")
    private Integer htAwayShotOnTarget;

    @Column(name = "ft_home_shot_on_target")
    private Integer ftHomeShotOnTarget;

    @Column(name = "ft_away_shot_on_target")
    private Integer ftAwayShotOnTarget;

    @Column(name = "ht_total_shot_on_target", columnDefinition = "tinyint unsigned generated always as (coalesce(ht_home_shot_on_target, 0) + coalesce(ht_away_shot_on_target, 0)) stored", insertable = false, updatable = false)
    private Integer htTotalShotOnTarget;

    @Column(name = "ft_total_shot_on_target", columnDefinition = "tinyint unsigned generated always as (coalesce(ft_home_shot_on_target, 0) + coalesce(ft_away_shot_on_target, 0)) stored", insertable = false, updatable = false)
    private Integer ftTotalShotOnTarget;

    @Column(name = "created_at", columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt;

    @Column(name = "updated_at", columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
    private LocalDateTime updatedAt;
}
