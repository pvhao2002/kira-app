drop table if exists crawl_date;
create table crawl_date
(
    id         int not null auto_increment primary key,
    date       varchar(255),
    status     enum ('pending', 'in_progress', 'completed', 'failed', 'picked') default 'pending',
    created_at timestamp                                                       default current_timestamp,
    constraint unique_crawl_date unique (date)
);

drop table if exists event_analyst;
create table event_analyst
(
    event_id                bigint auto_increment primary key,
    event_name              varchar(255),
    home_team               varchar(255),
    away_team               varchar(255),
    league_name             varchar(255),
    event_date              datetime,
    ht_home_score           int,
    ht_away_score           int,
    ft_home_score           int,
    ft_away_score           int,
    ht_score_str            varchar(255),
    ft_score_str            varchar(255),
    home_corner             int,
    away_corner             int,
    corner_str              varchar(255),
    link                    text,
    ft_total_goal           int                                                    default 0,
    ht_total_goal           int                                                    default 0,
    total_corner            int                                                    default 0,
    league_id               int,
    first_home_odds         float,
    last_home_odds          float,
    first_away_odds         float,
    last_away_odds          float,
    first_over_odds         float,
    last_over_odds          float,
    first_under_odds        float,
    last_under_odds         float,
    first_hdc               varchar(25),
    last_hdc                varchar(25),
    first_ou                varchar(25),
    last_ou                 varchar(25),
    home_logo               text,
    away_logo               text,
    first_corner            varchar(25),
    first_over_corner_odds  float,
    first_under_corner_odds float,
    last_corner             varchar(25),
    last_over_corner_odds   float,
    last_under_corner_odds  float,
    status                  enum ('pending', 'in_progress', 'completed', 'failed', 'picked') default 'pending',
    constraint unique_event unique (event_date, event_name),
    index idx_event (event_date, event_name),
    index idx_home_away_league (league_name, home_team, away_team)
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

drop table if exists invalid_line;
create table if not exists invalid_line
(
    line       varchar(25) primary key,
    created_at timestamp default current_timestamp,
    updated_at timestamp default current_timestamp on update current_timestamp
);
