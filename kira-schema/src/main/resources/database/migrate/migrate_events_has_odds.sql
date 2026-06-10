use kira;

alter table events
    add column if not exists has_odds tinyint(1) default 0 after link;

alter table events
    add column if not exists has_odds_corner tinyint(1) default 0 after has_odds;
