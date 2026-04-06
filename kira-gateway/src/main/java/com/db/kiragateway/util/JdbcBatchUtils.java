package com.db.kiragateway.util;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.util.CollectionUtils;

import java.util.List;
import java.util.logging.Logger;

public final class JdbcBatchUtils {

    private static final Logger log = Logger.getLogger(JdbcBatchUtils.class.getName());
    private static final int BATCH_SIZE = 150;

    private JdbcBatchUtils() {}

    public static void batchInsertSafe(NamedParameterJdbcTemplate jdbcTemplate, String sql, List<MapSqlParameterSource> params) {
        if (CollectionUtils.isEmpty(params)) {
            log.info("JdbcBatchUtils >> Skip batchInsertSafe: params is empty");
            return;
        }

        int total = params.size();
        for (int i = 0; i < total; i += BATCH_SIZE) {
            int end = Math.min(i + BATCH_SIZE, total);
            var subList = params.subList(i, end);
            try {
                jdbcTemplate.batchUpdate(sql, subList.toArray(MapSqlParameterSource[]::new));
            } catch (Exception e) {
                insertRangeOneByOne(jdbcTemplate, sql, subList, i, end);
            }
        }
    }

    private static void insertRangeOneByOne(NamedParameterJdbcTemplate jdbcTemplate, String sql,
                                            List<MapSqlParameterSource> subList, int startIdx, int endIdx) {
        for (int j = 0; j < subList.size(); j++) {
            var param = subList.get(j);
            try {
                jdbcTemplate.update(sql, param);
            } catch (Exception e) {
                log.warning("JdbcBatchUtils >> insert row " + (startIdx + j) + " failed: " + e.getMessage());
            }
        }
    }
}
