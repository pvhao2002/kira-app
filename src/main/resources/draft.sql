select ft_score_str, count(1) as cnt
from event_analyst
where true
  and first_hdc = '-1/1.5#+1/1.5'
  and last_hdc = '-1/1.5#+1/1.5'
  and first_ou = '3/3.5'
  and last_ou = '3/3.5'
  and ((first_home_odds < first_away_odds and first_over_odds > first_under_odds)
    or -- based on big small odd handicap and over under odd
       (last_home_odds < last_away_odds and last_over_odds > last_under_odds))
  and (last_home_odds < last_away_odds and last_over_odds > last_under_odds) -- base on greater in above sql
  and (last_home_odds < last_away_odds and (last_over_odds > last_under_odds))
group by ft_score_str
order by cnt desc;

-- -1/1.5 1.90 1.95
-- -1/1.5 1.90 1.95
-- 3/3.5 2.00 1.85
-- 3/3.5  1.97 1.87


select COUNT(1)                                          AS total_count,
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
;



WITH score_counts AS (SELECT e.event_name,
                             e.event_date,
                             ea.ft_score_str,
                             COUNT(*)                                                             AS score_count,
                             ROW_NUMBER() OVER (PARTITION BY e.event_name ORDER BY COUNT(*) DESC) AS rn
                      FROM event_analyst ea
                               INNER JOIN events e
                                          ON e.first_hdc = ea.first_hdc
                                              AND e.last_hdc = ea.last_hdc
                                              AND e.first_ou = ea.first_ou
                                              AND e.last_ou = ea.last_ou
                                              AND e.last_home_odds = ea.last_home_odds
                                              AND e.last_over_odds = ea.last_over_odds
                      WHERE e.event_date > '2025-08-14 14:00:00'
                      GROUP BY e.event_name, e.event_date, ea.ft_score_str)
SELECT event_name,
       event_date,
       ft_score_str,
       score_count
FROM score_counts
WHERE rn < 3
ORDER BY event_date, event_name

