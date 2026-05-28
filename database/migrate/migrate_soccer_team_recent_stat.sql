use kira;

create table if not exists soccer_team_recent_stat
(
    stat_id              bigint auto_increment primary key,
    metric_type          enum ('TOTAL_GOALS_3_PLUS', 'TOTAL_CORNERS_10_PLUS', 'FIRST_HALF_GOAL') not null,
    team_id              int                                                                     not null,
    team_name            varchar(100)                                                            not null,
    window_start         date                                                                    not null,
    window_end           date                                                                    not null,
    eligible_match_count int unsigned                                                            not null,
    matched_match_count  int unsigned                                                            not null,
    percentage           decimal(6, 2)                                                           not null,
    rank_no              int unsigned                                                            not null,
    computed_at          datetime                                                                not null default now(),
    created_at           datetime                                                                         default now(),
    updated_at           datetime                                                                         default now() on update now(),
    unique key uk_strs_metric_team_window (metric_type, team_id, window_end),
    index idx_strs_metric_rank (metric_type, rank_no),
    index idx_strs_computed_at (computed_at),
    constraint fk_strs_team foreign key (team_id) references teams (team_id) on delete cascade
) engine = InnoDB
  row_format = dynamic;
