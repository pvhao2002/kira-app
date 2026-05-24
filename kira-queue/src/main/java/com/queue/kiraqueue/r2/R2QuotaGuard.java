package com.queue.kiraqueue.r2;

import com.queue.kiraqueue.config.R2Properties;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.logging.Level;

@Log
@Service
@RequiredArgsConstructor
public class R2QuotaGuard {

    private static final DateTimeFormatter PERIOD_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM");

    private static final String SQL_SELECT = """
            select period, storage_bytes, class_a_ops, halted
            from r2_upload_quota
            where period = :period
            """;

    private static final String SQL_INSERT = """
            insert into r2_upload_quota (period, storage_bytes, class_a_ops, halted)
            values (:period, 0, 0, 0)
            on duplicate key update period = period
            """;

    private static final String SQL_UPDATE_USAGE = """
            update r2_upload_quota
            set storage_bytes = storage_bytes + :bytes,
                class_a_ops = class_a_ops + 1
            where period = :period
            """;

    private static final String SQL_HALT = """
            update r2_upload_quota
            set halted = 1
            where period = :period
            """;

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final R2Properties properties;

    private final AtomicBoolean halted = new AtomicBoolean(false);
    private volatile String loadedPeriod;
    private volatile boolean warnLogged;

    public boolean canUpload() {
        refreshIfNeeded();
        if (halted.get()) {
            return false;
        }
        var row = loadCurrentRow();
        if (row == null) {
            return true;
        }
        if (row.halted()) {
            haltIfNeeded("R2 free tier limit reached; logo uploads disabled until next month or manual reset");
            return false;
        }
        if (isOverLimit(row.storageBytes(), row.classAOps())) {
            jdbcTemplate.update(SQL_HALT, new MapSqlParameterSource("period", currentPeriod()));
            haltIfNeeded("R2 free tier limit reached; logo uploads disabled until next month or manual reset");
            return false;
        }
        maybeWarn(row.storageBytes(), row.classAOps());
        return true;
    }

    public void recordUpload(long bytes) {
        ensurePeriodRow();
        jdbcTemplate.update(
                SQL_UPDATE_USAGE,
                new MapSqlParameterSource("period", currentPeriod()).addValue("bytes", bytes)
        );
        refreshIfNeeded();
    }

    @Scheduled(cron = "0 0 0 1 * *")
    public void resetMonthlyCache() {
        loadedPeriod = null;
        halted.set(false);
        warnLogged = false;
        log.info("R2 quota guard cache reset for new month");
    }

    private void refreshIfNeeded() {
        var period = currentPeriod();
        if (!period.equals(loadedPeriod)) {
            loadedPeriod = period;
            halted.set(false);
            warnLogged = false;
            var row = loadCurrentRow();
            if (row != null && row.halted()) {
                halted.set(true);
            }
        }
    }

    private void haltIfNeeded(String message) {
        if (halted.compareAndSet(false, true)) {
            log.log(Level.WARNING, message);
        }
    }

    private void maybeWarn(long storageBytes, long classAOps) {
        if (warnLogged) {
            return;
        }
        var quota = properties.getQuota();
        var storageThreshold = quota.getMaxStorageBytes() * quota.getWarnAtPercent() / 100L;
        var opsThreshold = quota.getMaxClassAOpsMonth() * quota.getWarnAtPercent() / 100L;
        if (storageBytes >= storageThreshold || classAOps >= opsThreshold) {
            warnLogged = true;
            log.log(Level.WARNING, "R2 usage at ~{0}% of free tier (storage={1} bytes, classAOps={2})"
                    .formatted(quota.getWarnAtPercent(), storageBytes, classAOps));
        }
    }

    private boolean isOverLimit(long storageBytes, long classAOps) {
        var quota = properties.getQuota();
        return storageBytes >= quota.getMaxStorageBytes()
                || classAOps >= quota.getMaxClassAOpsMonth();
    }

    private QuotaRow loadCurrentRow() {
        var rows = jdbcTemplate.query(
                SQL_SELECT,
                new MapSqlParameterSource("period", currentPeriod()),
                (rs, rn) -> new QuotaRow(
                        rs.getString("period"),
                        rs.getLong("storage_bytes"),
                        rs.getLong("class_a_ops"),
                        rs.getBoolean("halted")
                )
        );
        return rows.isEmpty() ? null : rows.getFirst();
    }

    private void ensurePeriodRow() {
        jdbcTemplate.update(SQL_INSERT, new MapSqlParameterSource("period", currentPeriod()));
    }

    private static String currentPeriod() {
        return YearMonth.now().format(PERIOD_FORMAT);
    }

    public record QuotaRow(String period, long storageBytes, long classAOps, boolean halted) {
    }
}
