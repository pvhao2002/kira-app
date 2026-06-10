use kira;

set @event_claim_status_col := (
    select if(
        count(*) = 0,
        "alter table event_claim add column status enum('processing', 'completed', 'failed') not null default 'processing' after claimed_at",
        'select 1'
    )
    from information_schema.columns
    where table_schema = database()
      and table_name = 'event_claim'
      and column_name = 'status'
);
prepare event_claim_status_col_stmt from @event_claim_status_col;
execute event_claim_status_col_stmt;
deallocate prepare event_claim_status_col_stmt;

set @event_claim_status_claimed_at_idx := (
    select if(
        count(*) = 0,
        'alter table event_claim add index idx_event_claim_status_claimed_at (status, claimed_at)',
        'select 1'
    )
    from information_schema.statistics
    where table_schema = database()
      and table_name = 'event_claim'
      and index_name = 'idx_event_claim_status_claimed_at'
);
prepare event_claim_status_claimed_at_idx_stmt from @event_claim_status_claimed_at_idx;
execute event_claim_status_claimed_at_idx_stmt;
deallocate prepare event_claim_status_claimed_at_idx_stmt;

-- Backfill: terminal events with full pre-match odds were intentionally kept claimed.
update event_claim ec
    join events e on e.event_id = ec.event_id
    left join aiscore_match_status_ref r
      on r.status_type = 'status_id'
     and r.code = e.status_id
     and r.sport_id = 1
set ec.status = 'completed'
where (
        (r.ref_id is not null and r.is_terminal = 1)
     or (e.status_id is null and e.status = 'FT')
    )
  and exists (
        select 1
        from event_odds o
        where o.event_id = e.event_id
          and o.type = 'pre-match'
          and o.market = 'hdc'
    )
  and exists (
        select 1
        from event_odds o
        where o.event_id = e.event_id
          and o.type = 'pre-match'
          and o.market = 'ou'
    )
  and (
        coalesce(e.has_odds_corner, 0) = 0
     or exists (
            select 1
            from event_odds o
            where o.event_id = e.event_id
              and o.type = 'pre-match'
              and o.market = 'corner'
        )
    );
