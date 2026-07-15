use kira;

create table if not exists credit_card_mcc_categories (
    mcc_category_id bigint auto_increment primary key,
    user_id int not null,
    mcc_code char(4) not null,
    category_name varchar(160) not null,
    description text null,
    active tinyint(1) not null default 1,
    created_at datetime not null default current_timestamp,
    updated_at datetime not null default current_timestamp on update current_timestamp,
    unique key uk_cc_mcc_user_code (user_id, mcc_code),
    index idx_cc_mcc_user_active (user_id, active)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists credit_card_cashback_rules (
    cashback_rule_id bigint auto_increment primary key,
    user_id int not null,
    credit_card_id bigint not null,
    mcc_category_id bigint not null,
    cashback_rate decimal(5,2) not null,
    monthly_cap_amount decimal(15,2) null,
    effective_from date not null,
    effective_to date null,
    active tinyint(1) not null default 1,
    note text null,
    created_at datetime not null default current_timestamp,
    updated_at datetime not null default current_timestamp on update current_timestamp,
    unique key uk_cc_rule_start (credit_card_id, mcc_category_id, effective_from),
    index idx_cc_rule_user_card_active (user_id, credit_card_id, active)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists credit_card_statement_cycles (
    statement_cycle_id bigint auto_increment primary key,
    user_id int not null,
    credit_card_id bigint not null,
    cycle_month date not null,
    statement_date date not null,
    due_date date not null,
    statement_amount decimal(15,2) null,
    statement_issued_at datetime null,
    note text null,
    created_at datetime not null default current_timestamp,
    updated_at datetime not null default current_timestamp on update current_timestamp,
    unique key uk_cc_statement_cycle (user_id, credit_card_id, cycle_month),
    index idx_cc_statement_user_due (user_id, due_date),
    index idx_cc_statement_card_month (credit_card_id, cycle_month)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists credit_card_cashback_transactions (
    transaction_id bigint auto_increment primary key,
    user_id int not null,
    credit_card_id bigint not null,
    mcc_category_id bigint null,
    transaction_date date not null,
    customer_name varchar(160) null,
    bill_reference varchar(160) null,
    description varchar(512) null,
    spend_amount decimal(15,2) not null,
    discount_rate decimal(5,2) not null,
    discount_amount decimal(15,2) not null,
    cashback_rate_snapshot decimal(5,2) not null,
    monthly_cap_snapshot decimal(15,2) null,
    expected_cashback_amount decimal(15,2) not null,
    actual_cashback_amount decimal(15,2) null,
    cashback_due_date date null,
    cashback_received_at date null,
    status varchar(20) not null default 'PENDING',
    note text null,
    created_at datetime not null default current_timestamp,
    updated_at datetime not null default current_timestamp on update current_timestamp,
    index idx_cc_tx_user_status_due (user_id, status, cashback_due_date),
    index idx_cc_tx_card_date (credit_card_id, transaction_date)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

set @cc_statement_column_sql = (
    select if(count(*) = 0,
              'alter table credit_card_payments add column statement_cycle_id bigint null after user_id',
              'select 1')
    from information_schema.columns
    where table_schema = database()
      and table_name = 'credit_card_payments'
      and column_name = 'statement_cycle_id'
);
prepare cc_statement_column_stmt from @cc_statement_column_sql;
execute cc_statement_column_stmt;
deallocate prepare cc_statement_column_stmt;

set @cc_statement_index_sql = (
    select if(count(*) = 0,
              'create index idx_ccp_statement_cycle on credit_card_payments (statement_cycle_id)',
              'select 1')
    from information_schema.statistics
    where table_schema = database()
      and table_name = 'credit_card_payments'
      and index_name = 'idx_ccp_statement_cycle'
);
prepare cc_statement_index_stmt from @cc_statement_index_sql;
execute cc_statement_index_stmt;
deallocate prepare cc_statement_index_stmt;
