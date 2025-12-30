drop table if exists `predict`;
create table if not exists `predict`
(
    predict_id              bigint primary key auto_increment,
    event_name              varchar(150),
    event_date              datetime,
    league_name             varchar(100),
    league_id               int,
    event_link              varchar(255),

    score_home              int,
    score_away              int,
    score_str               varchar(10),

    first_hdc_line          varchar(25),
    first_home_odds         decimal(6, 3),
    first_away_odds         decimal(6, 3),
    last_hdc_line           varchar(25),
    last_home_odds          decimal(6, 3),
    last_away_odds          decimal(6, 3),

    first_ou_line           varchar(25),
    first_over_odds         decimal(6, 3),
    first_under_odds        decimal(6, 3),
    last_ou_line            varchar(25),
    last_over_odds          decimal(6, 3),
    last_under_odds         decimal(6, 3),

    first_corner_line       varchar(25),
    first_over_corner_odds  decimal(6, 3),
    first_under_corner_odds decimal(6, 3),
    last_corner_line        varchar(25),
    last_over_corner_odds   decimal(6, 3),
    last_under_corner_odds  decimal(6, 3),

    created_at              timestamp default current_timestamp,
    updated_at              timestamp default current_timestamp on update current_timestamp,

    unique key `event_name_event_date` (`event_name`, `event_date`),
    index `idx_event_date` (`event_date`, `event_name`)
);

drop table if exists predict_detail;
create table if not exists predict_detail
(
    predict_detail_id bigint primary key auto_increment,
    predict_type      enum ('simple', 'complex', 'combine'),
    predict_id        bigint,
    predict_score     varchar(255),
    hdc_pick          enum ('home', 'away', 'none'),
    ou_pick           enum ('over', 'under', 'none'),
    hdc_count         int       default 0,
    ou_count          int       default 0,
    match_count       int       default 0,

    result_hdc        enum ('win', 'lose', 'draw', 'cancel', 'void'),
    result_ou         enum ('win', 'lose', 'draw', 'cancel', 'void'),
    result_score      enum ('win', 'lose', 'draw', 'cancel', 'void'),
    created_at        timestamp default current_timestamp,
    updated_at        timestamp default current_timestamp on update current_timestamp,
    unique key (predict_id, predict_type)
);

drop table if exists predict_log;
create table if not exists predict_log
(
    predict_log_id bigint primary key auto_increment,
    predict_type   enum ('simple', 'complex', 'combine'),
    predict_id     bigint,
    predict_score  varchar(50),
    hdc_pick       enum ('home', 'away', 'none'),
    ou_pick        enum ('over', 'under', 'none'),
    created_at     timestamp default current_timestamp,
    updated_at     timestamp default current_timestamp on update current_timestamp
);
