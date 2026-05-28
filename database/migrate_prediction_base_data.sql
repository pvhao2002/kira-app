use kira;

create table if not exists prediction_version
(
    prediction_version_id bigint auto_increment primary key,
    code                  varchar(64)  not null,
    display_name          varchar(128) not null,
    description           text         null,
    is_active             tinyint(1)   not null default 1,
    sort_order            int          not null default 0,
    created_at            datetime     not null default current_timestamp,
    unique key uk_prediction_version_code (code)
) engine = InnoDB
  row_format = dynamic;

create table if not exists event_prediction
(
    event_prediction_id     bigint auto_increment primary key,
    event_id                bigint       not null,
    prediction_version_id   bigint       not null,
    status                  enum ('pending', 'completed', 'skipped', 'failed') not null default 'pending',
    prematch_hdc_line       varchar(25)  null,
    prematch_ou_line        varchar(25)  null,
    prematch_hdc_price_a    decimal(10, 2) null,
    prematch_hdc_price_b    decimal(10, 2) null,
    prematch_ou_price_a     decimal(10, 2) null,
    prematch_ou_price_b     decimal(10, 2) null,
    hdc_pick                enum ('HOME', 'AWAY', 'OVER', 'UNDER', 'DRAW', 'NONE') null,
    ou_pick                 enum ('HOME', 'AWAY', 'OVER', 'UNDER', 'DRAW', 'NONE') null,
    hdc_vote_count          int          null,
    ou_vote_count           int          null,
    match_sample_count      int          null,
    error_message           varchar(512) null,
    created_at              datetime     not null default current_timestamp,
    updated_at              datetime     not null default current_timestamp on update current_timestamp,
    unique key uk_event_prediction_event_version (event_id, prediction_version_id),
    index idx_event_prediction_version_status (prediction_version_id, status),
    constraint fk_event_prediction_event foreign key (event_id) references events (event_id) on delete cascade,
    constraint fk_event_prediction_version foreign key (prediction_version_id) references prediction_version (prediction_version_id)
) engine = InnoDB
  row_format = dynamic;

create table if not exists event_prediction_score
(
    event_prediction_score_id bigint auto_increment primary key,
    event_prediction_id       bigint       not null,
    rank_no                   tinyint unsigned not null,
    ft_goal_str               varchar(10)  not null,
    match_count               int          not null,
    hdc_pick                  enum ('HOME', 'AWAY', 'OVER', 'UNDER', 'DRAW', 'NONE') not null,
    ou_pick                   enum ('HOME', 'AWAY', 'OVER', 'UNDER', 'DRAW', 'NONE') not null,
    unique key uk_event_prediction_score_rank (event_prediction_id, rank_no),
    constraint fk_event_prediction_score_prediction foreign key (event_prediction_id) references event_prediction (event_prediction_id) on delete cascade
) engine = InnoDB
  row_format = dynamic;

insert into prediction_version (code, display_name, description, is_active, sort_order)
values ('base_data', 'Base Data', 'Match historical odds lines at open and pre-match and vote HDC/O-U from top scores.', 1, 1)
on duplicate key update display_name = values(display_name),
                        description  = values(description),
                        is_active    = values(is_active),
                        sort_order   = values(sort_order);
