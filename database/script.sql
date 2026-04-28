use kira;

-- Drop theo thứ tự phụ thuộc FK (bảng con trước, events sau)
drop table if exists event_crawl_failed;
drop table if exists event_odds_timeline;
drop table if exists event_odds;
drop table if exists event_incident;
drop table if exists event_result;
drop table if exists event_claim;
drop table if exists transaction_ai_extractions;
drop table if exists transactions;
drop table if exists events;
drop table if exists teams;
drop table if exists leagues;
drop table if exists users;
drop table if exists crawl_date;
drop table if exists event_crawl_failed;

-- crawl_date: varchar(20) đủ cho yyyyMMdd/yyyy-MM-dd (app dùng cho URL), index status cho query pending/picked
create table crawl_date
(
    date         varchar(20) primary key,
    status       enum ('pending', 'picked', 'in_progress', 'done', 'failed') default 'pending',
    message      text,
    total_events int                                                         default 0,
    created_at   datetime                                                    default now(),
    updated_at   datetime                                                    default now() on update now(),
    index idx_status (status)
) engine = InnoDB
  row_format = dynamic;

create table users
(
    user_id    int primary key auto_increment,
    username   varchar(50)  not null,
    password   varchar(100) not null,
    status     varchar(20) default 'active',
    role       varchar(20) default 'user',
    avatar     varchar(512),
    created_at datetime    default now(),
    updated_at datetime    default now() on update now(),
    unique key uk_username (username),
    index idx_status (status)
) engine = InnoDB
  row_format = dynamic;

-- Existing environments should run this once before deploying code using avatar:
-- alter table users add column avatar varchar(512) null after role;

create table transactions
(
    transaction_id bigint auto_increment primary key,
    user_id        int                                             not null,
    type           enum ('withdraw', 'deposit', 'bonus')           not null,
    amount         decimal(15, 2)                                  not null default 0,
    transaction_at datetime                                        not null,
    description    text,
    source         enum ('manual', 'ai')                           not null default 'manual',
    status         enum ('success', 'processing', 'failed')        not null default 'success',
    created_at     datetime                                        default now(),
    updated_at     datetime                                        default now() on update now(),
    index idx_transactions_user_time (user_id, transaction_at desc),
    index idx_transactions_user_type_time (user_id, type, transaction_at desc),
    constraint fk_transactions_user foreign key (user_id) references users (user_id) on delete cascade
) engine = InnoDB
  row_format = dynamic;

create table transaction_ai_extractions
(
    extraction_id      bigint auto_increment primary key,
    transaction_id     bigint null,
    user_id            int                                              not null,
    file_name          varchar(255),
    prompt             text                                             not null,
    ai_raw_response    mediumtext,
    parsed_datetime    varchar(100)                                     not null default '',
    parsed_money       varchar(100)                                     not null default '',
    parsed_text        text,
    parsed_type        varchar(20)                                      not null default '',
    parse_status       enum ('success', 'invalid_json', 'invalid_type', 'error') not null default 'success',
    parse_error        text,
    created_at         datetime                                         default now(),
    index idx_extraction_user_created (user_id, created_at desc),
    index idx_extraction_transaction (transaction_id),
    constraint fk_extraction_transaction foreign key (transaction_id) references transactions (transaction_id) on delete set null,
    constraint fk_extraction_user foreign key (user_id) references users (user_id) on delete cascade
) engine = InnoDB
  row_format = dynamic;

create table leagues
(
    league_id    int auto_increment primary key,
    league_name  varchar(255) not null,
    logo_url     text,
    country      varchar(100),
    is_main      tinyint(1) default 0,
    total_events int        default 0,
    created_at   datetime   default now(),
    updated_at   datetime   default now() on update now(),
    unique key uk_league_name (league_name),
    index idx_country (country)
) engine = InnoDB
  row_format = dynamic;

create table teams
(
    team_id    int auto_increment primary key,
    team_name  varchar(100) not null,
    logo_url   text,
    created_at datetime default now(),
    updated_at datetime default now() on update now(),
    unique key uk_team_name (team_name)
) engine = InnoDB
  row_format = dynamic;


create table events
(
    event_id    bigint auto_increment primary key,
    external_id varchar(100) not null comment 'id of provider',
    league_id   int,
    home_id     int,
    away_id     int,
    event_name  varchar(255),
    event_date  datetime     not null,
    status      varchar(25) default '-',
    link        text         null,
    created_at  datetime    default now(),
    updated_at  datetime    default now() on update now(),
    unique key uk_external_event (external_id),
    index idx_event_date (event_date),
    index idx_event_date_event_name (event_date, event_name),
    index idx_league_date_name (league_id, event_date, event_name),
    index idx_home_away (home_id, away_id)
) engine = InnoDB
  row_format = dynamic;

create table event_claim
(
    claim_id    bigint auto_increment primary key,
    event_id    bigint      not null,
    claimed_by  varchar(100) not null,
    claimed_at  datetime    default now(),
    unique key uk_event_claim_event_id (event_id),
    index idx_claimed_by_claimed_at (claimed_by, claimed_at),
    index idx_claimed_at (claimed_at),
    constraint fk_event_claim_event foreign key (event_id) references events (event_id) on delete cascade
) engine = InnoDB
  row_format = dynamic;

create table event_result
(
    event_id                bigint primary key,

    ht_result               enum ('H', 'D', 'A', 'None'),
    ht_goal_str             varchar(10),
    ft_result               enum ('H', 'D', 'A', 'None'),
    ft_goal_str             varchar(10),

    ht_home_goal            tinyint unsigned,
    ht_away_goal            tinyint unsigned,
    ft_home_goal            tinyint unsigned,
    ft_away_goal            tinyint unsigned,
    ht_total_goal           tinyint unsigned
        generated always as (coalesce(ht_home_goal, 0) + coalesce(ht_away_goal, 0)) stored,
    ft_total_goal           tinyint unsigned
        generated always as (coalesce(ft_home_goal, 0) + coalesce(ft_away_goal, 0)) stored,

    ht_home_corner          tinyint unsigned,
    ht_away_corner          tinyint unsigned,
    ft_home_corner          tinyint unsigned,
    ft_away_corner          tinyint unsigned,
    ht_total_corner         tinyint unsigned
        generated always as (coalesce(ht_home_corner, 0) + coalesce(ht_away_corner, 0)) stored,
    ft_total_corner         tinyint unsigned
        generated always as (coalesce(ft_home_corner, 0) + coalesce(ft_away_corner, 0)) stored,

    ht_home_yellow_card     tinyint unsigned,
    ht_away_yellow_card     tinyint unsigned,
    ft_home_yellow_card     tinyint unsigned,
    ft_away_yellow_card     tinyint unsigned,
    ht_total_yellow_card    tinyint unsigned
        generated always as (coalesce(ht_home_yellow_card, 0) + coalesce(ht_away_yellow_card, 0)) stored,
    ft_total_yellow_card    tinyint unsigned
        generated always as (coalesce(ft_home_yellow_card, 0) + coalesce(ft_away_yellow_card, 0)) stored,

    ht_home_foul            tinyint unsigned,
    ht_away_foul            tinyint unsigned,
    ft_home_foul            tinyint unsigned,
    ft_away_foul            tinyint unsigned,
    ht_total_foul           tinyint unsigned
        generated always as (coalesce(ht_home_foul, 0) + coalesce(ht_away_foul, 0)) stored,
    ft_total_foul           tinyint unsigned
        generated always as (coalesce(ft_home_foul, 0) + coalesce(ft_away_foul, 0)) stored,

    ht_home_offside         tinyint unsigned,
    ht_away_offside         tinyint unsigned,
    ft_home_offside         tinyint unsigned,
    ft_away_offside         tinyint unsigned,
    ht_total_offside        tinyint unsigned
        generated always as (coalesce(ht_home_offside, 0) + coalesce(ht_away_offside, 0)) stored,
    ft_total_offside        tinyint unsigned
        generated always as (coalesce(ft_home_offside, 0) + coalesce(ft_away_offside, 0)) stored,

    ht_home_total_shot      tinyint unsigned,
    ht_away_total_shot      tinyint unsigned,
    ft_home_total_shot      tinyint unsigned,
    ft_away_total_shot      tinyint unsigned,
    ht_total_shot           tinyint unsigned
        generated always as (coalesce(ht_home_total_shot, 0) + coalesce(ht_away_total_shot, 0)) stored,
    ft_total_shot           tinyint unsigned
        generated always as (coalesce(ft_home_total_shot, 0) + coalesce(ft_away_total_shot, 0)) stored,

    ht_home_shot_on_target  tinyint unsigned,
    ht_away_shot_on_target  tinyint unsigned,
    ft_home_shot_on_target  tinyint unsigned,
    ft_away_shot_on_target  tinyint unsigned,
    ht_total_shot_on_target tinyint unsigned
        generated always as (coalesce(ht_home_shot_on_target, 0) + coalesce(ht_away_shot_on_target, 0)) stored,
    ft_total_shot_on_target tinyint unsigned
        generated always as (coalesce(ft_home_shot_on_target, 0) + coalesce(ft_away_shot_on_target, 0)) stored,
    created_at              datetime default now(),
    updated_at              datetime default now() on update now()
) engine = InnoDB
  row_format = dynamic;

create table event_odds
(
    odds_id    bigint auto_increment primary key,
    event_id   bigint not null,
    type       enum ('open', 'pre-match', 'half-time')
        comment 'open is the initial odds, pre-match is the latest odds before the match starts, half-time is the odds at second half start',
    market     enum ('hdc', 'ou', 'corner'),
    line       varchar(25),
    price_a    decimal(10, 2),
    price_b    decimal(10, 2),
    created_at datetime default now(),
    unique key uk_event_market_type (event_id, market, type),
    index idx_event_market (event_id, type, market, line)
) engine = InnoDB
  row_format = dynamic;

-- timeline: nhiều dòng theo thời gian mỗi (event_id, market); index cho query theo event/market/crawled_at
create table event_odds_timeline
(
    odds_id      bigint auto_increment primary key,
    event_id     bigint not null,
    market       enum ('hdc', 'ou', 'corner'),
    line         varchar(25),
    price_a      decimal(10, 2),
    price_b      decimal(10, 2),
    match_minute varchar(10) comment 'e.g. HT, 45+, 60',
    crawled_at   datetime,
    created_at   datetime default now(),
    index idx_event_market (event_id, market),
    index idx_event_market_crawled (event_id, market, crawled_at),
    index idx_event_market_line (event_id, market, line)
) engine = InnoDB
  row_format = dynamic;

-- Sự kiện trong trận: thời gian ghi bàn, thẻ vàng, thẻ đỏ (theo phút và đội)
create table event_incident
(
    incident_id   bigint auto_increment primary key,
    event_id      bigint       not null,
    incident_type enum ('goal', 'yellow_card', 'red_card', 'second_yellow') not null
        comment 'goal = bàn thắng, yellow_card = thẻ vàng, red_card = thẻ đỏ trực tiếp, second_yellow = thẻ đỏ do 2 thẻ vàng',
    minute        smallint unsigned not null comment 'phút diễn ra (0-120, 45+ = hiệp 1 bù giờ)',
    minute_display varchar(10) null comment 'hiển thị e.g. 45+2, 90+4',
    period        enum ('1st_half', '2nd_half', 'extra_time_1', 'extra_time_2') default '1st_half',
    team_side     enum ('home', 'away') not null comment 'đội ghi bàn / đội nhận thẻ',
    player_name   varchar(100) null,
    is_penalty    tinyint(1) default 0 comment '1 nếu là penalty (chỉ với goal)',
    is_own_goal   tinyint(1) default 0 comment '1 nếu là phản lưới (chỉ với goal)',
    created_at   datetime default now(),
    updated_at   datetime default now() on update now(),
    index idx_event_id (event_id),
    index idx_event_type_minute (event_id, incident_type, minute),
    constraint fk_incident_event foreign key (event_id) references events (event_id) on delete cascade
) engine = InnoDB
  row_format = dynamic;

create table event_crawl_failed
(
    event_id   bigint,
    type       varchar(45),
    message    text,
    created_at datetime default now(),
    primary key pk_event_fail (event_id, type),
    index idx_event_fail (event_id)
) engine = InnoDB
  row_format = dynamic;

create table event_cancelled
(
    event_id   bigint primary key,
    event_name varchar(255),
    event_date datetime not null,
    status     varchar(25),
    link       text     null,
    created_at datetime default now()
);