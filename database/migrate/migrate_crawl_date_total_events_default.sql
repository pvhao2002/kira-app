-- Fix MySQL 1364 when INSERT omits total_events (column NOT NULL without DEFAULT).
use kira;

alter table crawl_date
    modify column total_events int not null default 0;
