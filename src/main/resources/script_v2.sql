drop table if exists crawl_date;
create table crawl_date
(
    id         int not null auto_increment primary key,
    date       varchar(255),
    status     enum ('pending', 'in_progress', 'completed', 'failed', 'regen') default 'pending',
    created_at timestamp                                                       default current_timestamp,
    constraint unique_crawl_date unique (date)
);

drop table if exists `event_crawl`;
create table if not exists `event_crawl`
(
    id          int not null auto_increment primary key,
    event_name  varchar(255),
    event_date  varchar(255),
    detail_link text,
    status      enum ('pending', 'in_progress', 'failed', 'regen') default 'pending',
    created_at  timestamp                                          default current_timestamp,
    constraint unique_event_crawl unique (event_name, event_date)
);

drop table if exists event_analyst;
create table event_analyst
(
    event_id         bigint auto_increment primary key,
    event_name       varchar(255),
    home_team        varchar(255),
    away_team        varchar(255),
    league_name      varchar(255),
    event_date       datetime,
    ht_home_score    int,
    ht_away_score    int,
    ft_home_score    int,
    ft_away_score    int,
    ht_score_str     varchar(255),
    ft_score_str     varchar(255),
    home_corner      int,
    away_corner      int,
    corner_str       varchar(255),
    link             text,
    ft_total_goal    int default 0,
    ht_total_goal    int default 0,
    total_corner     int default 0,
    league_id        int,
    first_home_odds  float,
    last_home_odds   float,
    first_away_odds  float,
    last_away_odds   float,
    first_over_odds  float,
    last_over_odds   float,
    first_under_odds float,
    last_under_odds  float,
    first_hdc        varchar(25),
    last_hdc         varchar(25),
    first_ou         varchar(25),
    last_ou          varchar(25),
    home_logo        text,
    away_logo        text,
    constraint unique_event unique (event_date, event_name),
    index idx_event (event_date, event_name),
    index idx_home_away_league (league_name, home_team, away_team)
);


drop table if exists odd_analyst;
create table if not exists odd_analyst
(
    event_id  bigint                                                            not null,
    odd_type  enum ('hdc', 'ou', '1x2', 'corner')                               not null,
    odd_value longtext                                                          null,
    status    enum ('done', 'in_progress', 'pending', 'fail') default 'pending' null,
    primary key (event_id, odd_type)
);


drop table if exists odd_event;
create table odd_event
(
    event_id      bigint,
    odd_type      enum ('1x2', 'ou', 'hdc', 'corner'),
    odd_date      datetime,
    line          varchar(25),
    home_line     decimal(10, 8),
    away_line     decimal(10, 8),
    home_odds     decimal(6, 2),
    draw_odds     decimal(6, 2),
    away_odds     decimal(6, 2),
    over_odds     decimal(6, 2),
    under_odds    decimal(6, 2),
    open_odd      tinyint(1) default 0,
    is_valid_line tinyint(1) default 1,
    created_at    datetime   default CURRENT_TIMESTAMP,
    updated_at    datetime   default CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP,
    primary key (event_id, odd_type, odd_date),
    index idx_odd_line (event_id, odd_type, line, open_odd),
    index idx_odd_line_odd_event (line, odd_type)
);

drop table if exists kira_league;
create table kira_league
(
    league_id   int auto_increment primary key,
    league_name varchar(100),
    is_main     tinyint(1) default 0,
    constraint league_name unique (league_name)
);

create table router_setting
(
    crawl_setting_id int auto_increment primary key,
    node             varchar(100)                         null,
    url              varchar(255)                         null,
    is_active        tinyint(1) default 0                 null,
    last_update      datetime   default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    constraint node unique (node)
);

create table pc
(
    pc_id    int auto_increment
        primary key,
    pc_name  varchar(255) null,
    event_id int          null,
    message  text         null,
    status   varchar(50)  null,
    index pc_name (pc_name, event_id)
);

drop table if exists schedule_manager;
create table schedule_manager
(
    schedule_name varchar(255),
    host_name     varchar(255),
    use_proxy     boolean                     default false,
    run_headless  boolean                     default true,
    status        enum ('active', 'inactive') default 'inactive',
    last_update   timestamp                   default current_timestamp on update current_timestamp,
    primary key (schedule_name, host_name)
);

drop table if exists app_logs;
create table if not exists app_logs
(
    log_id     serial primary key,
    host_name  varchar(100),
    level      varchar(20),
    logger     varchar(100),
    thread     varchar(100),
    message    text,
    created_at timestamp default now(),
    index idx_host_name (host_name)
);

drop table if exists invalid_line;
create table if not exists invalid_line
(
    line       varchar(25) primary key,
    created_at timestamp default current_timestamp,
    updated_at timestamp default current_timestamp on update current_timestamp
);
