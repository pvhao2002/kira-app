package com.app.kira.schedule;

import com.app.kira.producer.DateProducer;
import com.app.kira.util.DateUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.TimeUnit;

@Log
@Service
@RequiredArgsConstructor
public class DateSchedule {
    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final DateProducer dateProducer;
    private static final String SQL_GET_DATE = """
            select date
            from crawl_date
            where status = 'pending'
               or status = 'failed'
            limit 30
            """;


    @Scheduled(cron = "0 0 0,3,15,20 * * *", zone = "Asia/Ho_Chi_Minh")
    public void crawlTomorrowEvent() {
        for (var date : List.of(DateUtil.getTodayDate(), DateUtil.getTomorrowDate())) {
            dateProducer.sendDateTomorrow(date);
        }
        log.info("DateSchedule >> Scheduled crawl for today and tomorrow events.");
    }

    @Scheduled(fixedDelay = 1, timeUnit = TimeUnit.MINUTES, initialDelay = 1)
    public void crawlByDate() {
        var dates = jdbcTemplate.query(SQL_GET_DATE, (rs, rowNum) -> rs.getString("date"));
        for (var date : dates) {
            dateProducer.sendDate(date);
        }
        jdbcTemplate.batchUpdate(
                "update crawl_date set status = 'picked' where date = :date",
                dates.stream()
                        .map(date -> new MapSqlParameterSource("date", date))
                        .toArray(MapSqlParameterSource[]::new)
        );
        log.info("DateSchedule >> Scheduled crawl by date, total: " + dates.size());
    }
}
