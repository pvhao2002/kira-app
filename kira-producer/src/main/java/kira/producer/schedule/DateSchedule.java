package kira.producer.schedule;

import kira.producer.amqp.DateProducer;
import kira.producer.amqp.QueueBackpressureService;
import kira.producer.config.RabbitMQConfig;
import kira.producer.util.DateUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Log
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "kira.producer.crawl-schedule.enabled", havingValue = "true", matchIfMissing = true)
public class DateSchedule {
    private static final int QUEUE_MAX_MESSAGES = 200;

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final DateProducer dateProducer;
    private final QueueBackpressureService queueBackpressureService;

    private static final String SQL_GET_DATE = """
            select date
            from crawl_date
            where status = 'pending'
               or status = 'failed'
            limit 300
            """;

    @Scheduled(cron = "0 0 0,3,15,20 * * *", zone = "Asia/Ho_Chi_Minh")
    public void crawlTomorrowEvent() {
        if (queueBackpressureService.isQueueOverLimit(RabbitMQConfig.QUEUE_DATE_TOMORROW, QUEUE_MAX_MESSAGES)) {
            log.info("Skip crawlTomorrowEvent because queue " + RabbitMQConfig.QUEUE_DATE_TOMORROW + " has more than " + QUEUE_MAX_MESSAGES + " messages.");
            return;
        }
        for (var date : List.of(DateUtil.getTodayDate(), DateUtil.getTomorrowDate())) {
            dateProducer.sendDateTomorrow(date);
        }
        log.info("DateSchedule >> Scheduled crawl for today and tomorrow events.");
    }

    @Scheduled(fixedDelay = 1, timeUnit = TimeUnit.MINUTES, initialDelay = 1)
    public void crawlByDate() {
        if (queueBackpressureService.isQueueOverLimit(RabbitMQConfig.QUEUE_DATE, QUEUE_MAX_MESSAGES)) {
            log.info("Skip crawlByDate because queue " + RabbitMQConfig.QUEUE_DATE + " has more than " + QUEUE_MAX_MESSAGES + " messages.");
            return;
        }
        var dates = jdbcTemplate.query(SQL_GET_DATE, (rs, rowNum) -> rs.getString("date"));
        if (CollectionUtils.isEmpty(dates)) {
            return;
        }
        var queuedDates = new ArrayList<>(dates);
        queuedDates.forEach(dateProducer::sendDate);
        jdbcTemplate.batchUpdate(
                "update crawl_date set status = 'picked' where date = :date",
                queuedDates.stream()
                        .map(date -> new MapSqlParameterSource("date", date))
                        .toArray(MapSqlParameterSource[]::new)
        );
        log.info("DateSchedule >> Scheduled crawl by date, total: " + queuedDates.size());
    }
}
