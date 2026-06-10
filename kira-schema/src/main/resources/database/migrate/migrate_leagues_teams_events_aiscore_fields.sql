use kira;

-- leagues: external_id, has_stats, slug, sport_id, color
alter table leagues
    add column if not exists external_id varchar(100) null after country_code_short;

alter table leagues
    add column if not exists has_stats int null after external_id;

alter table leagues
    add column if not exists slug varchar(200) null after has_stats;

alter table leagues
    add column if not exists sport_id int null after slug;

alter table leagues
    add column if not exists color varchar(50) null after sport_id;

-- teams: external_id, sport_id
alter table teams
    add column if not exists external_id varchar(100) null after team_name;

alter table teams
    add column if not exists sport_id int null after external_id;

-- events: status_id
alter table events
    add column if not exists status_id int null after status;
