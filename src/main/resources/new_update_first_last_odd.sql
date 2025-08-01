SELECT oe.event_id,
       oe.odd_type,
       -- first record
       (SELECT home_odds
        FROM odd_event
        WHERE event_id = oe.event_id
          AND odd_type = oe.odd_type
        ORDER BY odd_date
        LIMIT 1) AS first_home_odds,
       (SELECT home_odds
        FROM odd_event
        WHERE event_id = oe.event_id
          AND odd_type = oe.odd_type
        ORDER BY odd_date DESC
        LIMIT 1) AS last_home_odds,

       (SELECT away_odds
        FROM odd_event
        WHERE event_id = oe.event_id
          AND odd_type = oe.odd_type
        ORDER BY odd_date
        LIMIT 1) AS first_away_odds,
       (SELECT away_odds
        FROM odd_event
        WHERE event_id = oe.event_id
          AND odd_type = oe.odd_type
        ORDER BY odd_date DESC
        LIMIT 1) AS last_away_odds,

       (SELECT over_odds
        FROM odd_event
        WHERE event_id = oe.event_id
          AND odd_type = oe.odd_type
        ORDER BY odd_date
        LIMIT 1) AS first_over_odds,
       (SELECT over_odds
        FROM odd_event
        WHERE event_id = oe.event_id
          AND odd_type = oe.odd_type
        ORDER BY odd_date DESC
        LIMIT 1) AS last_over_odds,

       (SELECT under_odds
        FROM odd_event
        WHERE event_id = oe.event_id
          AND odd_type = oe.odd_type
        ORDER BY odd_date
        LIMIT 1) AS first_under_odds,
       (SELECT under_odds
        FROM odd_event
        WHERE event_id = oe.event_id
          AND odd_type = oe.odd_type
        ORDER BY odd_date DESC
        LIMIT 1) AS last_under_odds,

       (SELECT line
        FROM odd_event
        WHERE event_id = oe.event_id
          AND odd_type = oe.odd_type
        ORDER BY odd_date
        LIMIT 1) AS first_line,
       (SELECT line
        FROM odd_event
        WHERE event_id = oe.event_id
          AND odd_type = oe.odd_type
        ORDER BY odd_date DESC
        LIMIT 1) AS last_line
FROM (SELECT DISTINCT event_id, odd_type
      FROM odd_event
      WHERE odd_type IN ('hdc', 'ou')) oe
