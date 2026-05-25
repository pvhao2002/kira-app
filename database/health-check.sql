SHOW STATUS LIKE 'Threads_connected';
SHOW VARIABLES LIKE 'max_connections';
SHOW STATUS LIKE 'Connections';
SET GLOBAL max_connections = 170;
GRANT SELECT, INSERT, UPDATE, DELETE
    ON kira.*
    TO 'kira'@'%';

SHOW GLOBAL STATUS LIKE 'Innodb_buffer_pool_read_requests';
SHOW GLOBAL STATUS LIKE 'Innodb_buffer_pool_reads';
SHOW GLOBAL STATUS LIKE 'Innodb_log_waits';

SELECT @@innodb_buffer_pool_size / 1024 / 1024 / 1024 AS size_in_GB,
       @@innodb_log_file_size / 1024 / 1024 / 1024 AS size_in_GB,
       @@max_connections;

SHOW VARIABLES WHERE Variable_name IN (
                                       'innodb_flush_log_at_trx_commit',
                                       'innodb_buffer_pool_size',
                                       'innodb_log_file_size', 'max_connections'
    );
SHOW FULL PROCESSLIST;

SELECT SUBSTRING_INDEX(host, ':', 1) AS ip_address, COUNT(*) AS connections
FROM information_schema.PROCESSLIST
GROUP BY ip_address
ORDER BY connections DESC;

SELECT r.trx_id              AS waiting_trx_id,
       r.trx_mysql_thread_id AS waiting_thread,
       r.trx_query           AS waiting_query,
       b.trx_id              AS blocking_trx_id,
       b.trx_mysql_thread_id AS blocking_thread,
       b.trx_query           AS blocking_query
FROM performance_schema.data_lock_waits dw
         JOIN performance_schema.threads wt ON dw.REQUESTING_THREAD_ID = wt.THREAD_ID
         JOIN performance_schema.threads bt ON dw.BLOCKING_THREAD_ID = bt.THREAD_ID
         JOIN information_schema.innodb_trx r ON r.trx_mysql_thread_id = wt.PROCESSLIST_ID
         JOIN information_schema.innodb_trx b ON b.trx_mysql_thread_id = bt.PROCESSLIST_ID;

SELECT object_schema, object_name, COUNT(*) as lock_count
FROM performance_schema.data_locks
GROUP BY object_schema, object_name;

SELECT trx_id,
       trx_state,
       trx_started,
       trx_mysql_thread_id,
       trx_query
FROM information_schema.innodb_trx;


-- Connection utilization monitor
SHOW GLOBAL STATUS LIKE 'Threads_connected';
SHOW VARIABLES LIKE 'max_connections';

SELECT @@hostname                                  AS host,
       @@port                                      AS port,
       @@max_connections                           AS max_connections,
       (SELECT VARIABLE_VALUE
        FROM performance_schema.global_status
        WHERE VARIABLE_NAME = 'Threads_connected') AS threads_connected,
       ROUND(
               (SELECT VARIABLE_VALUE
                FROM performance_schema.global_status
                WHERE VARIABLE_NAME = 'Threads_connected') / @@max_connections * 100,
               2
       )                                           AS connection_usage_pct,
       CASE
           WHEN (SELECT VARIABLE_VALUE
                 FROM performance_schema.global_status
                 WHERE VARIABLE_NAME = 'Threads_connected') / @@max_connections >= 0.80
               THEN 'WARN'
           ELSE 'OK'
           END                                     AS status;
