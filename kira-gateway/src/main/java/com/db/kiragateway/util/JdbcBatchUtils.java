package com.db.kiragateway.util;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.util.CollectionUtils;

import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;

public final class JdbcBatchUtils {

    private static final Logger log = Logger.getLogger(JdbcBatchUtils.class.getName());
    private static final int BATCH_SIZE = 500;

    private JdbcBatchUtils() {}

    public static void batchInsertSafe(NamedParameterJdbcTemplate jdbcTemplate, String sql, List<MapSqlParameterSource> params) {
        if (CollectionUtils.isEmpty(params)) {
            log.fine("JdbcBatchUtils >> Skip batchInsertSafe: params is empty");
            return;
        }

        int total = params.size();
        for (int i = 0; i < total; i += BATCH_SIZE) {
            int end = Math.min(i + BATCH_SIZE, total);
            var subList = params.subList(i, end);
            try {
                jdbcTemplate.batchUpdate(sql, subList.toArray(MapSqlParameterSource[]::new));
            } catch (Exception e) {
                log.log(Level.WARNING, "JdbcBatchUtils >> batch insert failed for range " + i + "-" + (end - 1) + ": " + e.getMessage());
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
                log.log(Level.WARNING, "JdbcBatchUtils >> insert row " + (startIdx + j) + " failed: " + e.getMessage());
            }
        }
        log.fine("JdbcBatchUtils >> fallback insert one-by-one done for range " + startIdx + "-" + (endIdx - 1));
    }
}
