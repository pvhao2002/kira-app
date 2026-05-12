use kira;

create table if not exists event_data_issue
(
    event_id    bigint                                       not null,
    issue_type  enum ('missing_stats', 'missing_odds', 'cancelled') not null,
    description longtext,
    screenshot  longtext,
    recorded_at datetime                                     default now(),
    primary key pk_event_data_issue (event_id, issue_type),
    index idx_issue_type_recorded_at (issue_type, recorded_at),
    constraint fk_event_data_issue_event foreign key (event_id) references events (event_id) on delete cascade
) engine = InnoDB
  row_format = dynamic;

insert into event_data_issue (event_id, issue_type, description, recorded_at)
select eno.event_id, 'missing_odds', null, eno.recorded_at
from event_no_odds eno
on duplicate key update recorded_at = values(recorded_at);

insert into event_data_issue (event_id, issue_type, description, recorded_at)
select ec.event_id, 'cancelled', null, ec.created_at
from event_cancelled ec
on duplicate key update recorded_at = values(recorded_at);

drop table if exists event_no_odds;
drop table if exists event_cancelled;

alter table event_crawl_failed
    add column if not exists screenshot longtext;

alter table event_data_issue
    add column if not exists screenshot longtext;

alter table event_data_issue
    modify column description longtext;
