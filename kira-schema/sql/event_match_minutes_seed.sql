-- Seed match clock reference rows into event_match_minutes (MySQL 8+).
-- Covers 1..44, 45, 45+1..45+30 (bù hiệp 1), 46..89, 90, 90+1..90+30 (bù hiệp 2), 91..130.
--
-- minute (sort / logic): phút “nguyên” dùng n * 1000 (vd 1 -> 1000, 46 -> 46000).
-- Bù giờ: 45000 + k cho 45+k (k = 1..30), 90000 + k cho 90+k (k = 1..30).
-- minute_display: ví dụ 1', 45', 45+3', 90+2'.
INSERT INTO event_match_minutes (minute, minute_display)
WITH RECURSIVE
    seq1 AS (SELECT 1 AS n
             UNION ALL
             SELECT n + 1
             FROM seq1
             WHERE n < 44),
    stoppage AS (SELECT 1 AS k
                 UNION ALL
                 SELECT k + 1
                 FROM stoppage
                 WHERE k < 30),
    seq2 AS (SELECT 46 AS n
             UNION ALL
             SELECT n + 1
             FROM seq2
             WHERE n < 89),
    seq3 AS (SELECT 91 AS n
             UNION ALL
             SELECT n + 1
             FROM seq3
             WHERE n < 130)
SELECT n AS minute, CONCAT(n, CHAR(39)) AS minute_display
FROM seq1
UNION ALL
SELECT 45, CONCAT('45', CHAR(39))
UNION ALL
SELECT 45, CONCAT('45+', k, CHAR(39))
FROM stoppage
UNION ALL
SELECT n, CONCAT(n, CHAR(39))
FROM seq2
UNION ALL
SELECT 90, CONCAT('90', CHAR(39))
UNION ALL
SELECT 90, CONCAT('90+', k, CHAR(39))
FROM stoppage
UNION ALL
SELECT n, CONCAT(n, CHAR(39))
FROM seq3;
