WITH target AS (
    SELECT
        0 AS target_event_id,
        '-1#+1' AS open_hdc_line,
        '-0.5#+0.5' AS prematch_hdc_line,
        '2.5' AS open_ou_line,
        '2.5' AS prematch_ou_line,
        '9.5' AS open_corner_line,
        '9.5' AS prematch_corner_line,
        CASE
            WHEN '9.5' IS NOT NULL AND '9.5' IS NOT NULL THEN 6
            ELSE 4
            END AS required_match_count
),
     matched_event AS (
         SELECT x.event_id
         FROM (
                  SELECT eo.event_id, 1 k
                  FROM event_odds eo JOIN target t
                  WHERE eo.market = 'hdc' AND eo.type = 'open' AND eo.line = t.open_hdc_line

                  UNION ALL
                  SELECT eo.event_id, 2 k
                  FROM event_odds eo JOIN target t
                  WHERE eo.market = 'hdc' AND eo.type = 'pre-match' AND eo.line = t.prematch_hdc_line

                  UNION ALL
                  SELECT eo.event_id, 3 k
                  FROM event_odds eo JOIN target t
                  WHERE eo.market = 'ou' AND eo.type = 'open' AND eo.line = t.open_ou_line

                  UNION ALL
                  SELECT eo.event_id, 4 k
                  FROM event_odds eo JOIN target t
                  WHERE eo.market = 'ou' AND eo.type = 'pre-match' AND eo.line = t.prematch_ou_line

                  UNION ALL
                  SELECT eo.event_id, 5 k
                  FROM event_odds eo JOIN target t
                  WHERE t.open_corner_line IS NOT NULL
                    AND t.prematch_corner_line IS NOT NULL
                    AND eo.market = 'corner'
                    AND eo.type = 'open'
                    AND eo.line = t.open_corner_line

                  UNION ALL
                  SELECT eo.event_id, 6 k
                  FROM event_odds eo JOIN target t
                  WHERE t.open_corner_line IS NOT NULL
                    AND t.prematch_corner_line IS NOT NULL
                    AND eo.market = 'corner'
                    AND eo.type = 'pre-match'
                    AND eo.line = t.prematch_corner_line
              ) x
                  JOIN target t
         GROUP BY x.event_id
         HAVING count(DISTINCT x.k) = max(t.required_match_count)
     )
SELECT
    er.ft_goal_str,
    count(*) AS match_count
FROM event_result er
         JOIN matched_event me ON me.event_id = er.event_id
         JOIN events e ON e.event_id = er.event_id
         JOIN target t
WHERE e.event_id <> t.target_event_id
  AND er.ft_goal_str IS NOT NULL
  AND er.ft_goal_str <> ''
GROUP BY er.ft_goal_str
ORDER BY match_count DESC, er.ft_goal_str ASC
LIMIT 3;
