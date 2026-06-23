use kira;

set @event_odds_countdistinct_market_type_idx := (
    select if(
        count(*) = 0,
        'alter table event_odds add index event_odds_idx_countdistinct_market_type_ (market, type, line)',
        'select 1'
    )
    from information_schema.statistics
    where table_schema = database()
      and table_name = 'event_odds'
      and index_name = 'event_odds_idx_countdistinct_market_type_'
);
prepare event_odds_countdistinct_market_type_idx_stmt from @event_odds_countdistinct_market_type_idx;
execute event_odds_countdistinct_market_type_idx_stmt;
deallocate prepare event_odds_countdistinct_market_type_idx_stmt;

set @event_odds_event_market_type_line_idx := (
    select if(
        count(*) = 0,
        'alter table event_odds add index event_odds_idx_event_market_type_line (event_id, market, type, line)',
        'select 1'
    )
    from information_schema.statistics
    where table_schema = database()
      and table_name = 'event_odds'
      and index_name = 'event_odds_idx_event_market_type_line'
);
prepare event_odds_event_market_type_line_idx_stmt from @event_odds_event_market_type_line_idx;
execute event_odds_event_market_type_line_idx_stmt;
deallocate prepare event_odds_event_market_type_line_idx_stmt;

set @event_result_ft_str_idx := (
    select if(
        count(*) = 0,
        'alter table event_result add index event_result_idx_ft_str (ft_goal_str)',
        'select 1'
    )
    from information_schema.statistics
    where table_schema = database()
      and table_name = 'event_result'
      and index_name = 'event_result_idx_ft_str'
);
prepare event_result_ft_str_idx_stmt from @event_result_ft_str_idx;
execute event_result_ft_str_idx_stmt;
deallocate prepare event_result_ft_str_idx_stmt;
