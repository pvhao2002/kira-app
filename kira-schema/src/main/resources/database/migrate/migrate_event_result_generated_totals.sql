use kira;

alter table event_result
    modify column ht_total_goal tinyint unsigned
        generated always as (coalesce(ht_home_goal, 0) + coalesce(ht_away_goal, 0)) stored,
    modify column ft_total_goal tinyint unsigned
        generated always as (coalesce(ft_home_goal, 0) + coalesce(ft_away_goal, 0)) stored,
    modify column ht_total_corner tinyint unsigned
        generated always as (coalesce(ht_home_corner, 0) + coalesce(ht_away_corner, 0)) stored,
    modify column ft_total_corner tinyint unsigned
        generated always as (coalesce(ft_home_corner, 0) + coalesce(ft_away_corner, 0)) stored,
    modify column ht_total_yellow_card tinyint unsigned
        generated always as (coalesce(ht_home_yellow_card, 0) + coalesce(ht_away_yellow_card, 0)) stored,
    modify column ft_total_yellow_card tinyint unsigned
        generated always as (coalesce(ft_home_yellow_card, 0) + coalesce(ft_away_yellow_card, 0)) stored,
    modify column ht_total_foul tinyint unsigned
        generated always as (coalesce(ht_home_foul, 0) + coalesce(ht_away_foul, 0)) stored,
    modify column ft_total_foul tinyint unsigned
        generated always as (coalesce(ft_home_foul, 0) + coalesce(ft_away_foul, 0)) stored,
    modify column ht_total_offside tinyint unsigned
        generated always as (coalesce(ht_home_offside, 0) + coalesce(ht_away_offside, 0)) stored,
    modify column ft_total_offside tinyint unsigned
        generated always as (coalesce(ft_home_offside, 0) + coalesce(ft_away_offside, 0)) stored,
    modify column ht_total_shot tinyint unsigned
        generated always as (coalesce(ht_home_total_shot, 0) + coalesce(ht_away_total_shot, 0)) stored,
    modify column ft_total_shot tinyint unsigned
        generated always as (coalesce(ft_home_total_shot, 0) + coalesce(ft_away_total_shot, 0)) stored,
    modify column ht_total_shot_on_target tinyint unsigned
        generated always as (coalesce(ht_home_shot_on_target, 0) + coalesce(ht_away_shot_on_target, 0)) stored,
    modify column ft_total_shot_on_target tinyint unsigned
        generated always as (coalesce(ft_home_shot_on_target, 0) + coalesce(ft_away_shot_on_target, 0)) stored;
