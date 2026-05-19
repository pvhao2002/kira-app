-- Database size overview in GB.
-- Run from MySQL client, for example:
-- docker exec kira-mysql-primary mysql -uroot -p1234 < database/check_database_size.sql

SELECT table_schema AS database_name,
       ROUND(SUM(data_length + index_length) / 1024 / 1024 / 1024, 3) AS total_gb,
       ROUND(SUM(data_length) / 1024 / 1024 / 1024, 3)                AS data_gb,
       ROUND(SUM(index_length) / 1024 / 1024 / 1024, 3)               AS index_gb,
       ROUND(SUM(data_free) / 1024 / 1024 / 1024, 3)                  AS free_gb
FROM information_schema.tables
WHERE table_schema NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
GROUP BY table_schema
ORDER BY total_gb DESC;

-- Largest tables in the application database.
SELECT table_schema AS database_name,
       table_name,
       ROUND((data_length + index_length) / 1024 / 1024 / 1024, 3) AS total_gb,
       ROUND(data_length / 1024 / 1024 / 1024, 3)                  AS data_gb,
       ROUND(index_length / 1024 / 1024 / 1024, 3)                 AS index_gb,
       ROUND(data_free / 1024 / 1024 / 1024, 3)                    AS free_gb,
       table_rows
FROM information_schema.tables
WHERE table_schema = 'kira'
  AND table_type = 'BASE TABLE'
ORDER BY data_length + index_length DESC
LIMIT 20;

-- Check whether screenshots are still taking space in event_data_issue.
SELECT COUNT(*) AS rows_count,
       SUM(screenshot IS NOT NULL AND screenshot <> '') AS rows_with_screenshot,
       ROUND(COALESCE(SUM(CHAR_LENGTH(screenshot)), 0) / 1024 / 1024 / 1024, 3) AS screenshot_gb
FROM kira.event_data_issue;

-- Binary logs also consume disk outside logical table size.
SHOW BINARY LOGS;
