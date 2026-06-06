package com.queue.kiraqueue.util;

import lombok.experimental.UtilityClass;
import lombok.extern.java.Log;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.util.CollectionUtils;

import java.util.List;

@Log
@UtilityClass
public class JdbcBatchUtils {
    private static final int BATCH_SIZE = 500;

    public void batchInsertSafe(NamedParameterJdbcTemplate jdbcTemplate, String sql, List<MapSqlParameterSource> params) {
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
                log.fine("JdbcBatchUtils >> batchInsertSafe >> Batch insert successful for range " + i + "-" + (end - 1));
            } catch (Exception e) {
                log.warning("JdbcBatchUtils >> batch insert failed for range " + i + "-" + (end - 1) + ": " + e.getMessage());
                insertRangeOneByOne(jdbcTemplate, sql, subList, i, end);
            }
        }
    }

    /** Fallback: insert từng dòng khi batch fail; log param khi insert fail. */
    private static void insertRangeOneByOne(NamedParameterJdbcTemplate jdbcTemplate, String sql,
                                            List<MapSqlParameterSource> subList, int startIdx, int endIdx) {
        for (int j = 0; j < subList.size(); j++) {
            var param = subList.get(j);
            try {
                jdbcTemplate.update(sql, param);
            } catch (Exception e) {
                log.warning("JdbcBatchUtils >> insert row " + (startIdx + j) + " failed: " + e.getMessage() + ", param=" + param);
            }
        }
        log.fine("JdbcBatchUtils >> fallback insert one-by-one done for range " + startIdx + "-" + (endIdx - 1));
    }
}
