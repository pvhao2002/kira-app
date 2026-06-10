use kira;

-- Additional indexes for large datasets. Each statement is guarded so this
-- migration can be re-run safely on environments that already have an index.

set @crawl_date_status_updated_at_idx := (
    select if(
        count(*) = 0,
        'alter table crawl_date add index idx_crawl_date_status_updated_at (status, updated_at)',
        'select 1'
    )
    from information_schema.statistics
    where table_schema = database()
      and table_name = 'crawl_date'
      and index_name = 'idx_crawl_date_status_updated_at'
);
prepare crawl_date_status_updated_at_idx_stmt from @crawl_date_status_updated_at_idx;
execute crawl_date_status_updated_at_idx_stmt;
deallocate prepare crawl_date_status_updated_at_idx_stmt;

set @events_status_date_id_idx := (
    select if(
        count(*) = 0,
        'alter table events add index idx_events_status_date_id (status, event_date, event_id)',
        'select 1'
    )
    from information_schema.statistics
    where table_schema = database()
      and table_name = 'events'
      and index_name = 'idx_events_status_date_id'
);
prepare events_status_date_id_idx_stmt from @events_status_date_id_idx;
execute events_status_date_id_idx_stmt;
deallocate prepare events_status_date_id_idx_stmt;

set @events_date_home_idx := (
    select if(
        count(*) = 0,
        'alter table events add index idx_events_date_home (event_date, home_id)',
        'select 1'
    )
    from information_schema.statistics
    where table_schema = database()
      and table_name = 'events'
      and index_name = 'idx_events_date_home'
);
prepare events_date_home_idx_stmt from @events_date_home_idx;
execute events_date_home_idx_stmt;
deallocate prepare events_date_home_idx_stmt;

set @events_date_away_idx := (
    select if(
        count(*) = 0,
        'alter table events add index idx_events_date_away (event_date, away_id)',
        'select 1'
    )
    from information_schema.statistics
    where table_schema = database()
      and table_name = 'events'
      and index_name = 'idx_events_date_away'
);
prepare events_date_away_idx_stmt from @events_date_away_idx;
execute events_date_away_idx_stmt;
deallocate prepare events_date_away_idx_stmt;

set @event_odds_type_market_event_idx := (
    select if(
        count(*) = 0,
        'alter table event_odds add index idx_event_odds_type_market_event (type, market, event_id)',
        'select 1'
    )
    from information_schema.statistics
    where table_schema = database()
      and table_name = 'event_odds'
      and index_name = 'idx_event_odds_type_market_event'
);
prepare event_odds_type_market_event_idx_stmt from @event_odds_type_market_event_idx;
execute event_odds_type_market_event_idx_stmt;
deallocate prepare event_odds_type_market_event_idx_stmt;

set @event_crawl_failed_type_event_idx := (
    select if(
        count(*) = 0,
        'alter table event_crawl_failed add index idx_event_crawl_failed_type_event (type, event_id)',
        'select 1'
    )
    from information_schema.statistics
    where table_schema = database()
      and table_name = 'event_crawl_failed'
      and index_name = 'idx_event_crawl_failed_type_event'
);
prepare event_crawl_failed_type_event_idx_stmt from @event_crawl_failed_type_event_idx;
execute event_crawl_failed_type_event_idx_stmt;
deallocate prepare event_crawl_failed_type_event_idx_stmt;

set @event_crawl_failed_type_created_at_idx := (
    select if(
        count(*) = 0,
        'alter table event_crawl_failed add index idx_event_crawl_failed_type_created_at (type, created_at)',
        'select 1'
    )
    from information_schema.statistics
    where table_schema = database()
      and table_name = 'event_crawl_failed'
      and index_name = 'idx_event_crawl_failed_type_created_at'
);
prepare event_crawl_failed_type_created_at_idx_stmt from @event_crawl_failed_type_created_at_idx;
execute event_crawl_failed_type_created_at_idx_stmt;
deallocate prepare event_crawl_failed_type_created_at_idx_stmt;

set @strs_window_metric_rank_idx := (
    select if(
        count(*) = 0,
        'alter table soccer_team_recent_stat add index idx_strs_window_metric_rank (window_end, metric_type, rank_no)',
        'select 1'
    )
    from information_schema.statistics
    where table_schema = database()
      and table_name = 'soccer_team_recent_stat'
      and index_name = 'idx_strs_window_metric_rank'
);
prepare strs_window_metric_rank_idx_stmt from @strs_window_metric_rank_idx;
execute strs_window_metric_rank_idx_stmt;
deallocate prepare strs_window_metric_rank_idx_stmt;

set @leagues_main_country_name_idx := (
    select if(
        count(*) = 0,
        'alter table leagues add index idx_leagues_main_country_name (is_main, country, league_name)',
        'select 1'
    )
    from information_schema.statistics
    where table_schema = database()
      and table_name = 'leagues'
      and index_name = 'idx_leagues_main_country_name'
);
prepare leagues_main_country_name_idx_stmt from @leagues_main_country_name_idx;
execute leagues_main_country_name_idx_stmt;
deallocate prepare leagues_main_country_name_idx_stmt;
