select event_id
     , IF(REPLACE(ht_score_str, 'HT ', '') = CONCAT(ht_home_score, '-', ht_away_score), 'CORRECT',
          'INCORRECT')                                                                        AS check_ht
     , IF(ft_score_str = CONCAT(ft_home_score, ' - ', ft_away_score), 'CORRECT', 'INCORRECT') AS check_ft
     , IF(corner_str = CONCAT(home_corner, ' - ', away_corner), 'CORRECT', 'INCORRECT')       AS check_corner
     , ht_score_str
     , ht_home_score
     , ht_away_score
     , ft_score_str
     , ft_home_score
     , ft_away_score
     , corner_str
     , home_corner
     , away_corner
from event_analyst
GROUP BY event_id
HAVING check_ht = 'INCORRECT'
    OR check_ft = 'INCORRECT'
    OR check_corner = 'INCORRECT';



UPDATE event_analyst ea
    JOIN (SELECT event_id,
                 -- Tách FT
                 CAST(SUBSTRING_INDEX(REPLACE(ft_score_str, ' ', ''), '-', 1) AS UNSIGNED)    AS ft_home_score,
                 CAST(SUBSTRING_INDEX(REPLACE(ft_score_str, ' ', ''), '-', -1) AS UNSIGNED)   AS ft_away_score,

                 -- Tách HT
                 CAST(SUBSTRING_INDEX(REPLACE(ht_score_str, 'HT ', ''), '-', 1) AS UNSIGNED)  AS ht_home_score,
                 CAST(SUBSTRING_INDEX(REPLACE(ht_score_str, 'HT ', ''), '-', -1) AS UNSIGNED) AS ht_away_score,

                 -- Tách corner
                 CAST(SUBSTRING_INDEX(REPLACE(corner_str, ' ', ''), '-', 1) AS UNSIGNED)      AS corner_home,
                 CAST(SUBSTRING_INDEX(REPLACE(corner_str, ' ', ''), '-', -1) AS UNSIGNED)     AS corner_away

          FROM event_analyst
          WHERE FALSE
             OR REPLACE(ht_score_str, 'HT ', '') <> CONCAT(ht_home_score, '-', ht_away_score)
             OR ft_score_str <> CONCAT(ft_home_score, ' - ', ft_away_score)
             OR corner_str <> CONCAT(home_corner, ' - ', away_corner)) AS corrected
    ON ea.event_id = corrected.event_id

SET ea.ft_home_score = corrected.ft_home_score,
    ea.ft_away_score = corrected.ft_away_score,
    ea.ht_home_score = corrected.ht_home_score,
    ea.ht_away_score = corrected.ht_away_score,
    ea.home_corner   = corrected.corner_home,
    ea.away_corner   = corrected.corner_away,
    ea.ft_total_goal = corrected.ft_home_score + corrected.ft_away_score,
    ea.ht_total_goal = corrected.ht_home_score + corrected.ht_away_score,
    ea.total_corner  = corrected.corner_home + corrected.corner_away;
