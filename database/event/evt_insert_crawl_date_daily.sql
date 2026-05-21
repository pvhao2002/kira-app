DELIMITER //
DROP EVENT IF EXISTS insert_crawl_date_daily //
CREATE EVENT IF NOT EXISTS insert_crawl_date_daily
    ON SCHEDULE EVERY 1 DAY
        STARTS CURRENT_DATE + INTERVAL 1 DAY
    DO
BEGIN
        INSERT IGNORE INTO crawl_date(date)
SELECT DATE_FORMAT(DATE_ADD('2015-01-01', INTERVAL n DAY), '%Y%m%d') AS formatted_date
FROM (SELECT a.N + b.N * 10 + c.N * 100 + d.N * 1000 AS n
      FROM (SELECT 0 AS N
            UNION ALL
            SELECT 1
            UNION ALL
            SELECT 2
            UNION ALL
            SELECT 3
            UNION ALL
            SELECT 4
            UNION ALL
            SELECT 5
            UNION ALL
            SELECT 6
            UNION ALL
            SELECT 7
            UNION ALL
            SELECT 8
            UNION ALL
            SELECT 9) a
               CROSS JOIN (SELECT 0 AS N
                           UNION ALL
                           SELECT 1
                           UNION ALL
                           SELECT 2
                           UNION ALL
                           SELECT 3
                           UNION ALL
                           SELECT 4
                           UNION ALL
                           SELECT 5
                           UNION ALL
                           SELECT 6
                           UNION ALL
                           SELECT 7
                           UNION ALL
                           SELECT 8
                           UNION ALL
                           SELECT 9) b
               CROSS JOIN (SELECT 0 AS N
                           UNION ALL
                           SELECT 1
                           UNION ALL
                           SELECT 2
                           UNION ALL
                           SELECT 3
                           UNION ALL
                           SELECT 4
                           UNION ALL
                           SELECT 5
                           UNION ALL
                           SELECT 6
                           UNION ALL
                           SELECT 7
                           UNION ALL
                           SELECT 8
                           UNION ALL
                           SELECT 9) c
               CROSS JOIN (SELECT 0 AS N
                           UNION ALL
                           SELECT 1
                           UNION ALL
                           SELECT 2
                           UNION ALL
                           SELECT 3
                           UNION ALL
                           SELECT 4
                           UNION ALL
                           SELECT 5
                           UNION ALL
                           SELECT 6
                           UNION ALL
                           SELECT 7
                           UNION ALL
                           SELECT 8
                           UNION ALL
                           SELECT 9) d) numbers
WHERE DATE_ADD('2015-01-01', INTERVAL n DAY) <= CURDATE()
  AND NOT EXISTS (SELECT 1
                  FROM events ea
                  WHERE DATE(ea.event_date) = DATE_ADD('2015-01-01', INTERVAL n DAY))
ORDER BY formatted_date;
END //
