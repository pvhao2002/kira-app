drop table if exists tecum_account;
create table if not exists tecum_account
(
    tecum_account_id int auto_increment primary key,
    tecum_name       varchar(255),
    tecum_cookie     text,
    tecum_username   varchar(255),
    tecum_password   varchar(255),
    created_at       datetime default current_timestamp,
    unique key uq_tecum_account_name (tecum_name)
);

drop table if exists tecum_attendance;
create table if not exists tecum_attendance
(
    attendance_id    int auto_increment primary key,
    tecum_account_id int,
    attendance_date  date,                                         -- ngày điểm danh
    status           enum ('PRESENT','ABSENT') default 'PRESENT',
    created_at       datetime                  default current_timestamp,
    unique key uq_account_date (tecum_account_id, attendance_date) -- 1 account chỉ có 1 record/ngày
);
