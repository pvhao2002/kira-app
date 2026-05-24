use kira;

-- Drop theo thứ tự phụ thuộc FK (bảng con trước, events sau)
drop table if exists event_crawl_failed;
drop table if exists event_data_issue;
drop table if exists event_no_odds;
drop table if exists event_cancelled;
drop table if exists event_odds_timeline;
drop table if exists event_odds;
drop table if exists event_incident;
drop table if exists event_result;
drop table if exists event_claim;
drop table if exists soccer_team_recent_stat;
drop table if exists aiscore_match_status_ref;
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
    index idx_status (status),
    index idx_crawl_date_status_updated_at (status, updated_at),
    index idx_crawl_date_total_events (total_events)
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
    transaction_id         bigint auto_increment primary key,
    user_id                int                                      not null,
    type                   enum ('withdraw', 'deposit', 'bonus')    not null,
    amount                 decimal(15, 2)                           not null default 0,
    transaction_at         datetime                                 not null,
    description            text,
    source                 enum ('manual', 'ai')                    not null default 'manual',
    status                 enum ('success', 'processing', 'failed') not null default 'success',
    receipt_image_base64   longtext,
    receipt_mime_type      varchar(100),
    receipt_file_name      varchar(255),
    ai_error               text,
    created_at             datetime                                 default now(),
    updated_at             datetime                                 default now() on update now(),
    index idx_transactions_user_time (user_id, transaction_at desc),
    index idx_transactions_user_type_time (user_id, type, transaction_at desc),
    index idx_transactions_ai_pending (status, source, transaction_id),
    constraint fk_transactions_user foreign key (user_id) references users (user_id) on delete cascade
) engine = InnoDB
  row_format = dynamic;

create table leagues
(
    league_id          int auto_increment primary key,
    league_name        varchar(255) not null,
    logo_url           text,
    logo               text,
    country            varchar(100),
    country_code_short char(3),
    external_id        varchar(100),
    has_stats          int,
    slug               varchar(200),
    sport_id           int,
    color              varchar(50),
    is_main            tinyint(1) default 0,
    total_events       int        default 0,
    created_at         datetime   default now(),
    updated_at         datetime   default now() on update now(),
    unique key uk_league_name (league_name),
    index idx_country (country),
    index idx_country_code_short (country_code_short),
    index idx_leagues_main_country_name (is_main, country, league_name)
) engine = InnoDB
  row_format = dynamic;

create table teams
(
    team_id     int auto_increment primary key,
    team_name   varchar(100) not null,
    external_id varchar(100),
    sport_id    int,
    logo_url    text,
    logo        text,
    created_at  datetime default now(),
    updated_at  datetime default now() on update now(),
    unique key uk_team_name (team_name)
) engine = InnoDB
  row_format = dynamic;

create table soccer_team_recent_stat
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
    index idx_strs_window_metric_rank (window_end, metric_type, rank_no),
    index idx_strs_computed_at (computed_at),
    constraint fk_strs_team foreign key (team_id) references teams (team_id) on delete cascade
) engine = InnoDB
  row_format = dynamic;

-- Tra cuu y nghia statusId (events.status_id) va matchStatus (AiScore API, bong da)
create table aiscore_match_status_ref
(
    ref_id       int auto_increment primary key,
    status_type  enum ('status_id', 'match_status') not null
        comment 'status_id = events.status_id; match_status = matchStatus gop tu API',
    code         int                                not null
        comment 'Gia tri so tu AiScore (statusId hoac matchStatus)',
    sport_id     int                                not null default 1
        comment '1 = football',
    label        varchar(50)                        not null
        comment 'Nhan hien thi tren AiScore (FT, HT, ...)',
    description  varchar(255)                       null
        comment 'Mo ta tieng Viet',
    is_in_play   tinyint(1)                         not null default 0,
    is_terminal  tinyint(1)                         not null default 0,
    sort_order   int                                not null default 0,
    created_at   datetime                           default now(),
    updated_at   datetime                           default now() on update now(),
    unique key uk_aiscore_match_status_ref (status_type, sport_id, code),
    index idx_aiscore_match_status_ref_type (status_type, sport_id, sort_order)
) engine = InnoDB
  row_format = dynamic
  comment = 'Tra cuu y nghia statusId va matchStatus (AiScore football)';

insert into aiscore_match_status_ref (status_type, code, sport_id, label, description, is_in_play, is_terminal, sort_order)
values
    ('status_id', 0, 1, '', 'Khong su dung / khong hien thi', 0, 0, 0),
    ('status_id', 1, 1, '-', 'Chua dau (Not started)', 0, 0, 10),
    ('status_id', 2, 1, '1H', 'Hiep 1 dang dien ra', 1, 0, 20),
    ('status_id', 3, 1, 'HT', 'Giu hiep (Half time)', 0, 0, 30),
    ('status_id', 4, 1, '2H', 'Hiep 2 dang dien ra', 1, 0, 40),
    ('status_id', 5, 1, 'ET', 'Hiep phu (Extra time)', 1, 0, 50),
    ('status_id', 6, 1, 'ET-HT', 'Nghi giua hiep phu', 0, 0, 55),
    ('status_id', 7, 1, 'Penalties', 'Luan luu penalty', 1, 0, 60),
    ('status_id', 8, 1, 'FT', 'Ket thuc sau 90 phut (Full time)', 0, 1, 70),
    ('status_id', 9, 1, 'Postponed', 'Hoan tran', 0, 1, 80),
    ('status_id', 10, 1, 'Interrupted', 'Gian doan', 0, 0, 90),
    ('status_id', 11, 1, 'Cut', 'Cat ngan / bo do', 0, 1, 100),
    ('status_id', 12, 1, 'Canceled', 'Huy tran', 0, 1, 110),
    ('status_id', 13, 1, 'Pending', 'Cho xac dinh (TBD)', 0, 0, 120),
    ('status_id', 105, 1, 'AET', 'Ket thuc sau hiep phu (After extra time)', 0, 1, 130),
    ('status_id', 110, 1, 'AP', 'Thang bang penalty (After penalties)', 0, 1, 140),
    ('match_status', 1, 1, 'NS', 'Chua dau (Not started)', 0, 0, 10),
    ('match_status', 2, 1, 'LIVE', 'Dang dien ra (gom 1H, HT, 2H, ET, ...)', 1, 0, 20),
    ('match_status', 3, 1, 'FT', 'Da ket thuc', 0, 1, 30),
    ('match_status', 4, 1, 'POSTPONED', 'Hoan tran', 0, 1, 40),
    ('match_status', 8, 1, 'PENDING', 'Cho xac dinh', 0, 0, 50);


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
    status_id   int,
    link        text         null,
    has_odds    tinyint(1) default 0,
    has_odds_corner tinyint(1) default 0,
    created_at  datetime    default now(),
    updated_at  datetime    default now() on update now(),
    unique key uk_external_event (external_id),
    index idx_event_date (event_date),
    index idx_events_status_date_id (status, event_date, event_id),
    index idx_events_date_home (event_date, home_id),
    index idx_events_date_away (event_date, away_id),
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
    index idx_event_market (event_id, type, market, line),
    index idx_event_odds_type_market_event (type, market, event_id)
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
    screenshot longtext,
    created_at datetime default now(),
    primary key pk_event_fail (event_id, type),
    index idx_event_fail (event_id),
    index idx_event_crawl_failed_type_event (type, event_id),
    index idx_event_crawl_failed_type_created_at (type, created_at)
) engine = InnoDB
  row_format = dynamic;

create table event_data_issue
(
    event_id    bigint                                       not null,
    issue_type  enum ('missing_stats', 'missing_odds', 'cancelled') not null,
    description longtext,
    screenshot  longtext,
    recorded_at datetime                                     default now(),
    primary key pk_event_data_issue (event_id, issue_type),
    index idx_issue_type_recorded_at (issue_type, recorded_at),
    index idx_event_data_issue_recorded_at (recorded_at),
    constraint fk_event_data_issue_event foreign key (event_id) references events (event_id) on delete cascade
) engine = InnoDB
  row_format = dynamic;

create table r2_upload_quota
(
    period          char(7)     not null primary key comment 'YYYY-MM',
    storage_bytes   bigint      not null default 0,
    class_a_ops     bigint      not null default 0,
    halted          tinyint(1)  not null default 0,
    created_at      datetime    default now(),
    updated_at      datetime    default now() on update now()
) engine = InnoDB
  row_format = dynamic;