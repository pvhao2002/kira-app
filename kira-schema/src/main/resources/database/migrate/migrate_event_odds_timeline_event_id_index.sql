use kira;

set @event_odds_timeline_event_id_idx := (
    select if(
        count(*) = 0,
        'alter table event_odds_timeline add index idx_event_odds_timeline_event_id (event_id)',
        'select 1'
    )
    from information_schema.statistics
    where table_schema = database()
      and table_name = 'event_odds_timeline'
      and index_name = 'idx_event_odds_timeline_event_id'
);
prepare event_odds_timeline_event_id_idx_stmt from @event_odds_timeline_event_id_idx;
execute event_odds_timeline_event_id_idx_stmt;
deallocate prepare event_odds_timeline_event_id_idx_stmt;
