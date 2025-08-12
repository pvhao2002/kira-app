drop table if exists `predict`;
create table if not exists `predict`
(
    predict_id     bigint primary key auto_increment,
    event_name     varchar(150),
    event_date     datetime,
    league_name    varchar(100),
    league_id      int,
    event_link     varchar(255),
    score_home     int,
    score_away     int,
    score_str      varchar(10),

    hdc_line       varchar(25),
    home_odds      decimal(6, 3),
    away_odds      decimal(6, 3),
    hdc_pick       enum ('home', 'away'),
    result_hdc     enum ('home', 'away', 'draw', 'cancel'),
    result_hdc_str enum ('win', 'lose', 'draw', 'cancel'),

    ou_line        varchar(25),
    over_odds      decimal(6, 3),
    under_odds     decimal(6, 3),
    ou_pick        enum ('over', 'under'),
    result_ou      enum ('over', 'under', 'draw', 'cancel'),
    result_ou_str  enum ('win', 'lose', 'draw', 'cancel'),

    created_at     timestamp default current_timestamp,
    updated_at     timestamp default current_timestamp on update current_timestamp,

    unique key `event_name_event_date` (`event_name`, `event_date`),
    index `idx_event_date` (`event_date`, `event_name`)
);

drop table if exists `predict_history`;
create table if not exists `predict_history`
(
    history_id bigint primary key auto_increment,
    predict_id bigint,                                                         -- liên kết tới bảng predict

    hdc_line   varchar(25),
    home_odds  decimal(6, 3),
    away_odds  decimal(6, 3),

    ou_line    varchar(25),
    over_odds  decimal(6, 3),
    under_odds decimal(6, 3),

    note       text,
    created_at timestamp default current_timestamp,                            -- thời điểm tạo
    updated_at timestamp default current_timestamp on update current_timestamp -- thời điểm thay đổi
);
