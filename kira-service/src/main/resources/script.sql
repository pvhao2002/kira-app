create database if not exists app;
use app;
drop table if exists crawl_date;
create table crawl_date
(
    date         varchar(255) primary key,
    status       enum ('pending', 'picked', 'in_progress', 'done', 'failed')                  default 'pending',
    total_events int       default 0,
    created_at   timestamp default current_timestamp,
    updated_at   timestamp default current_timestamp on update current_timestamp
);

drop table if exists users;
create table if not exists users
(
    user_id    int primary key auto_increment,
    username   varchar(50)  not null unique,
    password   varchar(255) not null,
    status     varchar(20) default 'active',
    role       varchar(20) default 'user',
    created_at timestamp   default current_timestamp,
    updated_at timestamp   default current_timestamp on update current_timestamp,
    unique key uk_username (username)
);

drop table if exists leagues;
create table leagues
(
    league_id    int auto_increment primary key,
    league_name  varchar(255) not null,
    logo_url     text,
    country      varchar(100),
    is_main      tinyint(1) default 0,
    total_events int        default 0,
    created_at   timestamp  default current_timestamp,
    updated_at   timestamp  default current_timestamp on update current_timestamp,
    unique key uk_league_name (league_name)
);
drop table if exists teams;
create table teams
(
    team_id    int auto_increment primary key,
    team_name  varchar(100) not null,
    logo_url   text,
    created_at timestamp default current_timestamp,
    updated_at timestamp default current_timestamp on update current_timestamp,
    unique key uk_team_name (team_name)
);


drop table if exists events;
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
    link        text,
    created_at  timestamp   default current_timestamp,
    updated_at  timestamp   default current_timestamp on update current_timestamp,
    unique key uk_external_event (external_id),
    index idx_event_date_event_name (event_date, event_name),
    index idx_league_date_name (league_id, event_date, event_name)
);

drop table if exists event_result;
create table if not exists event_result
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
        generated always as (coalesce(ht_away_offside, 0) + coalesce(ht_away_offside, 0)) stored,
    ft_total_offside        tinyint unsigned
        generated always as (coalesce(ft_away_offside, 0) + coalesce(ft_away_offside, 0)) stored,

    ht_home_total_shot      tinyint unsigned,
    ht_away_total_shot      tinyint unsigned,
    ft_home_total_shot      tinyint unsigned,
    ft_away_total_shot      tinyint unsigned,
    ht_total_shot           tinyint unsigned
        generated always as (coalesce(ht_away_total_shot, 0) + coalesce(ht_away_total_shot, 0)) stored,
    ft_total_shot           tinyint unsigned
        generated always as (coalesce(ft_away_total_shot, 0) + coalesce(ft_away_total_shot, 0)) stored,

    ht_home_shot_on_target  tinyint unsigned,
    ht_away_shot_on_target  tinyint unsigned,
    ft_home_shot_on_target  tinyint unsigned,
    ft_away_shot_on_target  tinyint unsigned,
    ht_total_shot_on_target tinyint unsigned
        generated always as (coalesce(ht_away_shot_on_target, 0) + coalesce(ht_away_shot_on_target, 0)) stored,
    ft_total_shot_on_target tinyint unsigned
        generated always as (coalesce(ft_home_shot_on_target, 0) + coalesce(ft_away_shot_on_target, 0)) stored,
    created_at              timestamp default current_timestamp,
    updated_at              timestamp default current_timestamp on update current_timestamp
);

drop table if exists event_odds;
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
    created_at timestamp default current_timestamp,
    unique key uk_event_market_type_line (event_id, market, type),
    index idx_event_market (event_id, type, market, line)
);


drop table if exists event_odds_timeline;
create table event_odds_timeline
(
    odds_id      bigint auto_increment primary key,
    event_id     bigint not null,
    type       enum ('open', 'pre-match', 'half-time')
        comment 'open is the initial odds, pre-match is the latest odds before the match starts, half-time is the odds at second half start',
    market     enum ('hdc', 'ou', 'corner'),
    line         varchar(25),
    price_a      decimal(10, 2),
    price_b      decimal(10, 2),

    match_minute varchar(10) comment 'the minute of the match when the odds was  captured, e.g., HT, 45+, 60',
    crawled_at   datetime,
    created_at   timestamp default current_timestamp,
    unique key uk_event_market_type_line (event_id, market, type),
    index idx_event_market (event_id, type, market, line)
);

drop table if exists event_crawl_failed;
CREATE TABLE event_crawl_failed
(
    event_id   BIGINT PRIMARY KEY,
    message    TEXT,
    html       LONGTEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
