
-- Tham số (chỉnh theo thực tế)
SET @claim_stale_after_seconds := 900;
SET @crawl_sec_per_event      := 5;    -- thời gian crawl 1 event
SET @consumer_sleep_sec       := 0;    -- sleep sau mỗi message (EventConsumer)
SET @avg_events_per_message   := 50;   -- producer gửi batch 50 event/message
SET @sec_per_day              := 86400;

-- Thời gian hiệu dụng / event (1 consumer)
SET @effective_sec_per_event := @crawl_sec_per_event
    + (@consumer_sleep_sec / @avg_events_per_message);

WITH
-- Backlog giống kira-producer: FT/terminal, có link, has_odds, chưa claim
backlog_producer AS (
    SELECT e.event_id
    FROM events e
    LEFT JOIN aiscore_match_status_ref r
      ON r.status_type = 'status_id'
     AND r.code = e.status_id
     AND r.sport_id = 1
    WHERE e.link IS NOT NULL
      AND COALESCE(e.has_odds, 0) = 1
      AND NOT EXISTS (
          SELECT 1
          FROM event_claim ec
          WHERE ec.event_id = e.event_id
            AND (
                  ec.status = 'completed'
               OR (
                      ec.status = 'processing'
                  AND TIMESTAMPDIFF(SECOND, ec.claimed_at, NOW()) < @claim_stale_after_seconds
                  )
            )
      )
      AND (
            (r.ref_id IS NOT NULL AND r.is_terminal = 1 AND r.code NOT IN (9, 12))
         OR (e.status_id IS NULL AND e.status = 'FT')
      )
),

-- Chưa có đủ odds snapshot (pre-match hdc + ou; + corner nếu has_odds_corner)
missing_full_odds AS (
    SELECT e.event_id
    FROM events e
    WHERE e.link IS NOT NULL
      AND COALESCE(e.has_odds, 0) = 1
      AND EXISTS (
          SELECT 1 FROM event_odds o
          WHERE o.event_id = e.event_id
            AND o.type = 'pre-match'
            AND o.market = 'hdc'
      )
      AND EXISTS (
          SELECT 1 FROM event_odds o
          WHERE o.event_id = e.event_id
            AND o.type = 'pre-match'
            AND o.market = 'ou'
      )
      AND (
          COALESCE(e.has_odds_corner, 0) = 0
          OR EXISTS (
              SELECT 1 FROM event_odds o
              WHERE o.event_id = e.event_id
                AND o.type = 'pre-match'
                AND o.market = 'corner'
          )
      )
),

-- Union: cần crawl (backlog queue HOẶC thiếu data DB)
need_crawl AS (
    SELECT event_id FROM backlog_producer
    UNION
    SELECT e.event_id
    FROM events e
    WHERE e.link IS NOT NULL
      AND COALESCE(e.has_odds, 0) = 1
      AND e.event_id NOT IN (SELECT event_id FROM missing_full_odds)
),

counts AS (
    SELECT
        (SELECT COUNT(*) FROM backlog_producer)     AS backlog_producer_cnt,
        (SELECT COUNT(*) FROM need_crawl)           AS need_crawl_cnt,
        (SELECT COUNT(*)
         FROM events e
         WHERE COALESCE(e.has_odds, 0) = 1
           AND e.link IS NOT NULL)                  AS total_has_odds_with_link
)

SELECT
    c.backlog_producer_cnt,
    c.need_crawl_cnt,
    c.total_has_odds_with_link,

    @effective_sec_per_event AS effective_sec_per_event,

    ROUND(86400 / @effective_sec_per_event, 0) AS events_per_consumer_per_day,

    ROUND(c.backlog_producer_cnt * @effective_sec_per_event / 86400, 2)
        AS days_to_clear_producer_backlog,

    ROUND(c.need_crawl_cnt * @effective_sec_per_event / 86400, 2)
        AS days_to_crawl_all_need_crawl,

    -- Chỉ 5s/event thuần (không tính sleep consumer)
    ROUND(c.need_crawl_cnt * @crawl_sec_per_event / 86400, 2)
        AS days_if_only_5s_crawl_no_sleep

FROM counts c;