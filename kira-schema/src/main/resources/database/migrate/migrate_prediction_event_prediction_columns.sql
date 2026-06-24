use kira;

set @sql := (
    select if(
        count(*) = 0,
        'alter table event_prediction add column open_hdc_line varchar(25) null after prematch_ou_line',
        'select 1'
    )
    from information_schema.columns
    where table_schema = database()
      and table_name = 'event_prediction'
      and column_name = 'open_hdc_line'
);
prepare stmt from @sql;
execute stmt;
deallocate prepare stmt;

set @sql := (
    select if(
        count(*) = 0,
        'alter table event_prediction add column open_ou_line varchar(25) null after open_hdc_line',
        'select 1'
    )
    from information_schema.columns
    where table_schema = database()
      and table_name = 'event_prediction'
      and column_name = 'open_ou_line'
);
prepare stmt from @sql;
execute stmt;
deallocate prepare stmt;

set @sql := (
    select if(
        count(*) = 0,
        'alter table event_prediction add column open_corner_line varchar(25) null after open_ou_line',
        'select 1'
    )
    from information_schema.columns
    where table_schema = database()
      and table_name = 'event_prediction'
      and column_name = 'open_corner_line'
);
prepare stmt from @sql;
execute stmt;
deallocate prepare stmt;

set @sql := (
    select if(
        count(*) = 0,
        'alter table event_prediction add column prematch_corner_line varchar(25) null after open_corner_line',
        'select 1'
    )
    from information_schema.columns
    where table_schema = database()
      and table_name = 'event_prediction'
      and column_name = 'prematch_corner_line'
);
prepare stmt from @sql;
execute stmt;
deallocate prepare stmt;

set @sql := (
    select if(
        count(*) = 0,
        'alter table event_prediction add column goal_str_pick varchar(100) null after prematch_ou_price_b',
        'select 1'
    )
    from information_schema.columns
    where table_schema = database()
      and table_name = 'event_prediction'
      and column_name = 'goal_str_pick'
);
prepare stmt from @sql;
execute stmt;
deallocate prepare stmt;

set @sql := (
    select if(
        count(*) = 0,
        'alter table event_prediction add column actual_ft_goal_str varchar(10) null after error_message',
        'select 1'
    )
    from information_schema.columns
    where table_schema = database()
      and table_name = 'event_prediction'
      and column_name = 'actual_ft_goal_str'
);
prepare stmt from @sql;
execute stmt;
deallocate prepare stmt;

set @sql := (
    select if(
        count(*) = 0,
        'alter table event_prediction add column result_hdc enum (''WIN'', ''LOSE'', ''VOID'', ''NONE'') null after actual_ft_goal_str',
        'select 1'
    )
    from information_schema.columns
    where table_schema = database()
      and table_name = 'event_prediction'
      and column_name = 'result_hdc'
);
prepare stmt from @sql;
execute stmt;
deallocate prepare stmt;

set @sql := (
    select if(
        count(*) = 0,
        'alter table event_prediction add column result_ou enum (''WIN'', ''LOSE'', ''VOID'', ''NONE'') null after result_hdc',
        'select 1'
    )
    from information_schema.columns
    where table_schema = database()
      and table_name = 'event_prediction'
      and column_name = 'result_ou'
);
prepare stmt from @sql;
execute stmt;
deallocate prepare stmt;

set @sql := (
    select if(
        count(*) = 0,
        'alter table event_prediction add column settled_at datetime null after result_ou',
        'select 1'
    )
    from information_schema.columns
    where table_schema = database()
      and table_name = 'event_prediction'
      and column_name = 'settled_at'
);
prepare stmt from @sql;
execute stmt;
deallocate prepare stmt;

set @sql := (
    select if(
        count(*) = 0,
        'alter table event_prediction add index idx_event_prediction_version_result_hdc (prediction_version_id, result_hdc, settled_at)',
        'select 1'
    )
    from information_schema.statistics
    where table_schema = database()
      and table_name = 'event_prediction'
      and index_name = 'idx_event_prediction_version_result_hdc'
);
prepare stmt from @sql;
execute stmt;
deallocate prepare stmt;

set @sql := (
    select if(
        count(*) = 0,
        'alter table event_prediction add index idx_event_prediction_version_result_ou (prediction_version_id, result_ou, settled_at)',
        'select 1'
    )
    from information_schema.statistics
    where table_schema = database()
      and table_name = 'event_prediction'
      and index_name = 'idx_event_prediction_version_result_ou'
);
prepare stmt from @sql;
execute stmt;
deallocate prepare stmt;
