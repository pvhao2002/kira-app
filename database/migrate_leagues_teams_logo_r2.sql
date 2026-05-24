use kira;

alter table leagues
    add column if not exists logo text null after logo_url;

alter table teams
    add column if not exists logo text null after logo_url;

create table if not exists r2_upload_quota
(
    period          char(7)     not null primary key comment 'YYYY-MM',
    storage_bytes   bigint      not null default 0,
    class_a_ops     bigint      not null default 0,
    halted          tinyint(1)  not null default 0,
    created_at      datetime    default now(),
    updated_at      datetime    default now() on update now()
) engine = InnoDB
  row_format = dynamic;
