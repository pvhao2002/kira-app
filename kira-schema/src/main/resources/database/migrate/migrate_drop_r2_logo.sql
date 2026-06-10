use kira;

drop table if exists r2_upload_quota;

alter table leagues drop column if exists logo;

alter table teams drop column if exists logo;
