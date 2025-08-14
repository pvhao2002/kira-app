select ft_score_str, count(1) as cnt
from event_analyst
where true
  and first_hdc = '-1/1.5#+1/1.5'
  and last_hdc = '-1/1.5#+1/1.5'
  and first_ou = '3/3.5'
  and last_ou = '3/3.5'

#   and first_home_odds < first_away_odds
#   and last_home_odds < last_away_odds
#   and first_over_odds > first_under_odds
#   and last_over_odds > last_under_odds
#   and ((first_home_odds < first_away_odds and first_over_odds > first_under_odds)
#     or
#        (last_home_odds < last_away_odds and last_over_odds > last_under_odds))
#   and (last_home_odds < last_away_odds and last_over_odds > last_under_odds)
  and (last_home_odds < last_away_odds and (last_over_odds > last_under_odds))
group by ft_score_str
order by cnt desc;

-- -1/1.5 1.90 1.95
-- -1/1.5 1.90 1.95
-- 3/3.5 2.00 1.85
-- 3/3.5  1.97 1.87


select event_name
     , event_date
     , CONCAT(first_hdc, ' ', first_home_odds, ' ', first_away_odds) AS first_hdc_odds
     , CONCAT(last_hdc, ' ', last_home_odds, ' ', last_away_odds)    AS last_hdc_odds
     , CONCAT(first_ou, ' ', first_over_odds, ' ', first_under_odds) AS first_ou_odds
     , CONCAT(last_ou, ' ', last_over_odds, ' ', last_under_odds)    AS last_ou_odds
from events
where event_date between '2025-08-14 04:00:00' and '2025-08-14 10:00:00'
  and first_hdc is not null
  and first_ou is not null
  and event_name not like '%(w)%'
  and event_name not like '%youth%';




select COUNT(*)                                          AS total_count,
       SUM(IF(first_home_odds < first_away_odds, 1, 0))  AS first_home_less_away,
       SUM(IF(first_home_odds > first_away_odds, 1, 0))  AS first_home_greater_away,
       SUM(IF(first_home_odds = first_away_odds, 1, 0))  AS first_home_equal_away,
       SUM(IF(last_home_odds < last_away_odds, 1, 0))    AS last_home_less_away,
       SUM(IF(last_home_odds > last_away_odds, 1, 0))    AS last_home_greater_away,
       SUM(IF(last_home_odds = last_away_odds, 1, 0))    AS last_home_equal_away,

       SUM(IF(first_over_odds < first_under_odds, 1, 0)) AS first_over_less_under,
       SUM(IF(first_over_odds > first_under_odds, 1, 0)) AS first_over_greater_under,
       SUM(IF(first_over_odds = first_under_odds, 1, 0)) AS first_over_equal_under,
       SUM(IF(last_over_odds < last_under_odds, 1, 0))   AS last_over_less_under,
       SUM(IF(last_over_odds > last_under_odds, 1, 0))   AS last_over_greater_under,
       SUM(IF(last_over_odds = last_under_odds, 1, 0))   AS last_over_equal_under
from event_analyst
where true
  and first_hdc = '-1/1.5#+1/1.5'
  and last_hdc = '-1/1.5#+1/1.5'
  and first_ou = '3/3.5'
  and last_ou = '3/3.5'

#   and first_hdc = '-1/1.5#+1/1.5'
#   and last_hdc = '-1.5#+1.5'
#   and first_ou = '2.5/3'
#   and last_ou = '2.5/3'

#   and first_hdc = '-0/0.5#+0/0.5'
#   and last_hdc = '-0/0.5#+0/0.5'
#   and first_ou = '2'
#   and last_ou = '2/2.5'

#   and first_hdc = '-0.5#+0.5'
#   and last_hdc = '-0.5/1#+0.5/1'
#   and first_ou = '2/2.5'
#   and last_ou = '2/2.5'
#
#   and first_hdc = '-0.5/1#+0.5/1'
#   and last_hdc = '-1/1.5#+1/1.5'
#   and first_ou = '2.5'
#   and last_ou = '2.5/3'
