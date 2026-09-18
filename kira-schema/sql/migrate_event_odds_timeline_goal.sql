use kira;

set @event_odds_timeline_goal_col := (
    select if(
        count(*) = 0,
        'alter table event_odds_timeline add column goal varchar(25) null after price_b',
        'select 1'
    )
    from information_schema.columns
    where table_schema = database()
      and table_name = 'event_odds_timeline'
      and column_name = 'goal'
);
prepare event_odds_timeline_goal_col_stmt from @event_odds_timeline_goal_col;
execute event_odds_timeline_goal_col_stmt;
deallocate prepare event_odds_timeline_goal_col_stmt;
