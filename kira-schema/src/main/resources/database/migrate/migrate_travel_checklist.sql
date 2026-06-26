use kira;

create table if not exists travel_checklist_plan
(
    plan_id    bigint auto_increment primary key,
    user_id    int          not null,
    plan_name  varchar(255) not null,
    is_public  tinyint(1)   not null default 0,
    created_at datetime default now(),
    updated_at datetime default now() on update now(),
    index idx_travel_checklist_plan_user (user_id),
    index idx_travel_checklist_plan_public (is_public, updated_at),
    constraint fk_travel_checklist_plan_user foreign key (user_id) references users (user_id) on delete cascade
) engine = InnoDB
  row_format = dynamic;

alter table travel_checklist_plan
    add column if not exists is_public tinyint(1) not null default 0 after plan_name;

alter table travel_checklist_plan
    modify column is_public tinyint(1) not null default 0;

create index if not exists idx_travel_checklist_plan_public
    on travel_checklist_plan (is_public, updated_at);

create table if not exists travel_checklist_group
(
    group_id      bigint auto_increment primary key,
    plan_id       bigint                 not null,
    schedule_type enum ('CHECK_LIST', 'DAY', 'TIME_SLOT') not null,
    schedule_date date,
    start_time    time,
    end_time      time,
    title         varchar(255)           not null,
    sort_order    int                    not null default 0,
    created_at    datetime                        default now(),
    updated_at    datetime                        default now() on update now(),
    index idx_travel_checklist_group_plan (plan_id),
    constraint fk_travel_checklist_group_plan foreign key (plan_id) references travel_checklist_plan (plan_id) on delete cascade
) engine = InnoDB
  row_format = dynamic;

create table if not exists travel_checklist_item
(
    item_id       bigint auto_increment primary key,
    group_id      bigint       not null,
    content       varchar(512) null,
    activity_time time,
    activity      varchar(512) not null,
    address       varchar(512),
    cost          decimal(15, 2),
    note          text,
    checked       tinyint(1)   not null default 0,
    sort_order    int          not null default 0,
    created_at    datetime              default now(),
    updated_at    datetime              default now() on update now(),
    index idx_travel_checklist_item_group (group_id),
    constraint fk_travel_checklist_item_group foreign key (group_id) references travel_checklist_group (group_id) on delete cascade
) engine = InnoDB
  row_format = dynamic;

alter table travel_checklist_group
    modify column schedule_type enum ('CHECK_LIST', 'DAY', 'TIME_SLOT') not null;

alter table travel_checklist_item
    modify column content varchar(512) null;

alter table travel_checklist_item
    add column if not exists activity_time time after content;

alter table travel_checklist_item
    add column if not exists activity varchar(512) null after activity_time;

alter table travel_checklist_item
    add column if not exists address varchar(512) null after activity;

alter table travel_checklist_item
    add column if not exists cost decimal(15, 2) null after address;

alter table travel_checklist_item
    add column if not exists note text null after cost;

update travel_checklist_item
set activity = coalesce(nullif(trim(activity), ''), nullif(trim(content), ''), 'Untitled activity')
where activity is null
   or trim(activity) = '';

alter table travel_checklist_item
    modify column activity varchar(512) not null;
