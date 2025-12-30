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
    private static final int BATCH_SIZE = 150;

    public void batchInsertSafe(NamedParameterJdbcTemplate jdbcTemplate, String sql, List<MapSqlParameterSource> params) {
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
                log.info("JdbcBatchUtils >> batchInsertSafe >> Batch insert successful for range " + i + "-" + (end - 1));
            } catch (Exception e) {
                log.warning("Batch insert failed for range {}-{}");
            }
        }
    }
}
