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
            limit 10
            """;


    @Scheduled(cron = "0 0 3,15,20 * * *", zone = "Asia/Ho_Chi_Minh")
    public void crawlTomorrowEvent() {
        for (var date : List.of(DateUtil.getTodayDate(), DateUtil.getTomorrowDate())) {
            log.info("DateSchedule >> crawlTomorrowEvent >> date:" + date);
            dateProducer.sendDateTomorrow(date);
        }
    }

    @Scheduled(fixedDelay = 2, timeUnit = TimeUnit.MINUTES)
    public void crawlByDate() {
        var dates = jdbcTemplate.query(SQL_GET_DATE, (rs, rowNum) -> rs.getString("date"));
        for (var date : dates) {
            log.info("DateSchedule >> crawlByDate >> date:" + date);
            dateProducer.sendDate(date);
        }
        jdbcTemplate.batchUpdate(
                "update crawl_date set status = 'picked' where date = :date",
                dates.stream()
                        .map(date -> new MapSqlParameterSource("date", date))
                        .toArray(MapSqlParameterSource[]::new)
        );
    }
}
