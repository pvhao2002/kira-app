use kira;

-- Run these on staging/production-like data after applying
-- migrate_large_data_indexes.sql. They are intentionally read-only.

set @claim_stale_after_seconds := 900;
set @window_start := now() - interval 3 month;
set @window_end := now();
set @window_start_date := date(@window_start);
set @window_end_date := date(@window_end);
set @computed_at := now();

-- Event claim/backfill: should prefer idx_events_status_date_id plus PK/unique
-- lookups on event_claim, event_data_issue, and event_odds.
explain
select e.event_id,
       e.external_id,
       e.league_id,
       e.home_id,
       e.away_id,
       e.event_name,
       e.event_date,
       e.status,
       e.link
from events e
left join event_claim ec on ec.event_id = e.event_id
where (ec.event_id is null
   or ec.status = 'failed'
   or (
        ec.status = 'processing'
    and timestampdiff(second, ec.claimed_at, now()) >= @claim_stale_after_seconds
      ))
  and e.status not in ('PENDING', 'POSTPONED', 'CANCELLED')
  and not exists (
      select 1
      from event_data_issue edi
      where edi.event_id = e.event_id
        and edi.issue_type = 'missing_odds'
  )
  and not exists (
      select 1
      from event_odds eo
      where eo.event_id = e.event_id
  )
order by e.event_date asc, e.event_id asc
limit 1;

-- Retry crawl failures: should prefer idx_event_crawl_failed_type_event.
explain
select distinct f.event_id
from event_crawl_failed f
where f.type in ('retry_main', 'retry_stats', 'retry_odds')
  and not exists (
    select 1
    from event_claim ec
    where ec.event_id = f.event_id
      and (
            ec.status = 'completed'
         or (
                ec.status = 'processing'
            and timestampdiff(second, ec.claimed_at, now()) < @claim_stale_after_seconds
            )
      )
  )
order by f.event_id
limit 20;

-- Latest soccer team stat API: should use idx_strs_window_metric_rank.
explain
select metric_type,
       rank_no,
       team_id,
       team_name,
       eligible_match_count,
       matched_match_count,
       percentage,
       window_start,
       window_end,
       computed_at
from soccer_team_recent_stat
where window_end = (
    select max(window_end)
    from soccer_team_recent_stat
)
order by field(metric_type, 'TOTAL_GOALS_3_PLUS', 'TOTAL_CORNERS_10_PLUS', 'FIRST_HALF_GOAL'),
         rank_no asc;

-- Recent stats recompute: should use idx_event_odds_type_market_event and the
-- events date/team indexes while building the CTEs.
explain
insert into soccer_team_recent_stat (
    metric_type,
    team_id,
    team_name,
    window_start,
    window_end,
    eligible_match_count,
    matched_match_count,
    percentage,
    rank_no,
    computed_at
)
with qualified_odds as (
    select event_id
    from event_odds
    where type in ('open', 'pre-match')
      and market in ('hdc', 'ou', 'corner')
    group by event_id
    having count(distinct concat(type, ':', market)) = 6
),
team_matches as (
    select e.event_id,
           e.home_id as team_id,
           t.team_name,
           er.ft_total_goal,
           er.ft_total_corner,
           er.ht_total_goal
    from events e
    join event_result er on er.event_id = e.event_id
    join teams t on t.team_id = e.home_id
    join qualified_odds on qualified_odds.event_id = e.event_id
    where e.event_date >= @window_start
      and e.event_date < @window_end
      and e.home_id is not null
    union all
    select e.event_id,
           e.away_id as team_id,
           t.team_name,
           er.ft_total_goal,
           er.ft_total_corner,
           er.ht_total_goal
    from events e
    join event_result er on er.event_id = e.event_id
    join teams t on t.team_id = e.away_id
    join qualified_odds on qualified_odds.event_id = e.event_id
    where e.event_date >= @window_start
      and e.event_date < @window_end
      and e.away_id is not null
)
select ranked.metric_type,
       ranked.team_id,
       ranked.team_name,
       @window_start_date,
       @window_end_date,
       ranked.eligible_match_count,
       ranked.matched_match_count,
       ranked.percentage,
       ranked.rank_no,
       @computed_at
from (
    select metric_rows.*,
           row_number() over (
               partition by metric_rows.metric_type
               order by metric_rows.percentage desc,
                        metric_rows.eligible_match_count desc,
                        metric_rows.team_name asc
           ) as rank_no
    from (
        select 'TOTAL_GOALS_3_PLUS' as metric_type,
               team_id,
               team_name,
               count(*) as eligible_match_count,
               sum(case when ft_total_goal >= 3 then 1 else 0 end) as matched_match_count,
               round(sum(case when ft_total_goal >= 3 then 1 else 0 end) * 100.0 / count(*), 2) as percentage
        from team_matches
        group by team_id, team_name
        having count(*) >= 5
        union all
        select 'TOTAL_CORNERS_10_PLUS' as metric_type,
               team_id,
               team_name,
               count(*) as eligible_match_count,
               sum(case when ft_total_corner >= 10 then 1 else 0 end) as matched_match_count,
               round(sum(case when ft_total_corner >= 10 then 1 else 0 end) * 100.0 / count(*), 2) as percentage
        from team_matches
        group by team_id, team_name
        having count(*) >= 5
        union all
        select 'FIRST_HALF_GOAL' as metric_type,
               team_id,
               team_name,
               count(*) as eligible_match_count,
               sum(case when ht_total_goal >= 1 then 1 else 0 end) as matched_match_count,
               round(sum(case when ht_total_goal >= 1 then 1 else 0 end) * 100.0 / count(*), 2) as percentage
        from team_matches
        group by team_id, team_name
        having count(*) >= 5
    ) metric_rows
) ranked
where ranked.rank_no <= 10;
