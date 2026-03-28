SELECT JSON_OBJECT(
               'columns', IFNULL((
                                     SELECT JSON_ARRAYAGG(
                                                    JSON_OBJECT(
                                                            'schema', cols.table_schema,
                                                            'table', cols.table_name,
                                                            'name', cols.column_name,
                                                            'type', cols.column_type,
                                                            'nullable', IF(cols.IS_NULLABLE = 'YES', 'true', 'false'),
                                                            'collation', IFNULL(cols.COLLATION_NAME, '')
                                                    )
                                            )
                                     FROM information_schema.columns cols
                                     WHERE table_schema NOT IN ('sys', 'mysql', 'information_schema', 'performance_schema')
                                 ), JSON_ARRAY()),
               'indexes', IFNULL((
                                     SELECT JSON_ARRAYAGG(
                                                    JSON_OBJECT(
                                                            'schema', indexes.table_schema,
                                                            'table', indexes.table_name,
                                                            'name', indexes.index_name,
                                                            'size', IFNULL(
                                                                    (SELECT SUM(stat_value * @@innodb_page_size)
                                                                     FROM mysql.innodb_index_stats
                                                                     WHERE stat_name = 'size'
                                                                       AND index_name = indexes.index_name
                                                                       AND table_name = indexes.table_name
                                                                       AND database_name = indexes.table_schema
                                                                    ), -1),
                                                            'column', indexes.column_name,
                                                            'index_type', LOWER(indexes.index_type),
                                                            'cardinality', indexes.cardinality,
                                                            'direction', CASE WHEN indexes.collation = 'D' THEN 'desc' ELSE 'asc' END,
                                                            'unique', IF(indexes.non_unique = 1, 'false', 'true')
                                                    )
                                            )
                                     FROM information_schema.statistics indexes
                                     WHERE table_schema NOT IN ('sys', 'mysql', 'information_schema', 'performance_schema')
                                 ), JSON_ARRAY()),
               'tables', IFNULL((
                                    SELECT JSON_ARRAYAGG(
                                                   JSON_OBJECT(
                                                           'schema', tbls.TABLE_SCHEMA,
                                                           'table', tbls.TABLE_NAME,
                                                           'rows', IFNULL(tbls.TABLE_ROWS, 0),
                                                           'type', IFNULL(tbls.TABLE_TYPE, ''),
                                                           'engine', IFNULL(tbls.ENGINE, ''),
                                                           'collation', IFNULL(tbls.TABLE_COLLATION, '')
                                                   )
                                           )
                                    FROM information_schema.tables tbls
                                    WHERE tbls.TABLE_TYPE <> 'VIEW' AND table_schema NOT IN ('sys', 'mysql', 'information_schema', 'performance_schema')
                                ), JSON_ARRAY()),
               'views', IFNULL((
                                   SELECT JSON_ARRAYAGG(
                                                  JSON_OBJECT(
                                                          'schema', views.TABLE_SCHEMA,
                                                          'view_name', views.TABLE_NAME,
                                                          'definition', REPLACE(REPLACE(TO_BASE64(VIEW_DEFINITION), ' ', ''), '
', '')
                                                  )
                                          )
                                   FROM information_schema.views views
                                   WHERE table_schema NOT IN ('sys', 'mysql', 'information_schema', 'performance_schema')
                               ), JSON_ARRAY()),
               'server_name', @@hostname,
               'version', VERSION()
       ) AS db_metadata;
