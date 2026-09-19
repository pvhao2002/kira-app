use kira;

create table if not exists karaoke_favorite_song
(
    song_id       bigint auto_increment primary key,
    user_id       int          not null,
    title         varchar(255) not null,
    artist        varchar(255),
    genre         varchar(100),
    karaoke_code  varchar(100),
    tone          varchar(50),
    link          varchar(1000),
    note          text,
    created_at    datetime default now(),
    updated_at    datetime default now() on update now(),
    index idx_karaoke_favorite_song_user_updated (user_id, updated_at),
    index idx_karaoke_favorite_song_user_title (user_id, title),
    constraint fk_karaoke_favorite_song_user foreign key (user_id) references users (user_id) on delete cascade
) engine = InnoDB
  row_format = dynamic;

create table if not exists job_application
(
    job_id          bigint auto_increment primary key,
    user_id         int          not null,
    company_name    varchar(255) not null,
    position_title  varchar(255) not null,
    location        varchar(255),
    job_url         varchar(1000),
    salary          varchar(255),
    employment_type varchar(100),
    status          varchar(30)  not null default 'SAVED',
    priority        varchar(20)  not null default 'MEDIUM',
    deadline        date,
    contact_name    varchar(255),
    contact_email   varchar(255),
    notes           text,
    created_at      datetime default now(),
    updated_at      datetime default now() on update now(),
    index idx_job_application_user_status_updated (user_id, status, updated_at),
    index idx_job_application_user_deadline (user_id, deadline),
    constraint fk_job_application_user foreign key (user_id) references users (user_id) on delete cascade
) engine = InnoDB
  row_format = dynamic;
