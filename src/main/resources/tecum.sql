drop table if exists tecum_account;
create table if not exists tecum_account
(
    tecum_account_id      int auto_increment primary key,
    tecum_name            varchar(255),
    balance               decimal(20, 2) default 0,
    balance_holding       decimal(20, 2) default 0,
    balance_left_dividend decimal(20, 2) default 0,
    withdrawal            decimal(20, 2) default 0,
    deposit               decimal(20, 2) default 0,
    profit                decimal(20, 2) default 0,
    bonus                 decimal(20, 2) default 0,
    commission            decimal(20, 2) default 0,
    tecum_cookie          text,
    tecum_username        varchar(255),
    tecum_password        varchar(255),
    noted                 text,
    created_at            datetime       default current_timestamp,
    updated_at            datetime       default current_timestamp on update current_timestamp,
    unique key uq_tecum_account_name (tecum_name)
);

drop table if exists tecum_transaction;
create table if not exists tecum_transaction
(
    cash_flow_id     int auto_increment primary key,
    tecum_account_id int,
    amount           decimal(20, 2) default 0 comment '-- số tiền giao dịch',
    balance          decimal(20, 2) default 0 comment '-- số dư sau giao dịch',
    transaction_date varchar(50),
    type             varchar(35),
    note             varchar(255),
    created_at       datetime       default current_timestamp,
    updated_at       datetime       default current_timestamp on update current_timestamp
);
