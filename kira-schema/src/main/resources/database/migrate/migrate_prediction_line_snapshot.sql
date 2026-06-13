use kira;

alter table event_prediction
    add column if not exists open_hdc_line varchar(25) null after prematch_ou_line,
    add column if not exists open_ou_line varchar(25) null after open_hdc_line,
    add column if not exists open_corner_line varchar(25) null after open_ou_line,
    add column if not exists prematch_corner_line varchar(25) null after open_corner_line;

update event_prediction ep
    inner join events e on e.event_id = ep.event_id
set ep.open_hdc_line = (
        select o.line
        from event_odds o
        where o.event_id = ep.event_id
          and o.market = 'hdc'
          and o.type = 'open'
          and o.line is not null
          and o.line <> ''
        limit 1
    ),
    ep.open_ou_line = (
        select o.line
        from event_odds o
        where o.event_id = ep.event_id
          and o.market = 'ou'
          and o.type = 'open'
          and o.line is not null
          and o.line <> ''
        limit 1
    ),
    ep.open_corner_line = (
        select o.line
        from event_odds o
        where o.event_id = ep.event_id
          and o.market = 'corner'
          and o.type = 'open'
          and o.line is not null
          and o.line <> ''
        limit 1
    ),
    ep.prematch_corner_line = (
        select o.line
        from event_odds o
        where o.event_id = ep.event_id
          and o.market = 'corner'
          and o.type = 'pre-match'
          and o.line is not null
          and o.line <> ''
        limit 1
    )
where ep.status = 'completed'
  and ep.open_hdc_line is null;
