insert into kira_league(league_name)
select distinct league_name
from event_analyst
order by league_name;

update event_analyst ea
    inner join kira_league kl on kl.league_name = ea.league_name
set ea.league_id = kl.league_id
where ea.league_id is null;
