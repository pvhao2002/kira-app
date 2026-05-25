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
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.logging.Level;

@Log
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "kira.producer.crawl-schedule.date-enabled", havingValue = "true", matchIfMissing = true)
public class DateSchedule {
    private static final int QUEUE_MAX_MESSAGES = 50;

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final DateProducer dateProducer;
    private final QueueBackpressureService queueBackpressureService;

    private static final String SQL_GET_DATE = """
            select date
            from crawl_date
            where false
                     or status in ('pending', 'failed')
                     or (updated_at + interval 30 minute < now() and status <> 'done')
                     or total_events = 0
            limit 20
            """;

    @Scheduled(cron = "0 0 22 * * *", zone = "Asia/Ho_Chi_Minh")
    public void crawlTomorrowEvent() {
        for (var date : List.of(DateUtil.getTomorrowDate())) {
            try {
                dateProducer.sendDateTomorrow(date);
                jdbcTemplate.update(
                        """
                                insert into crawl_date (date, status, total_events) values (:date, 'picked', 0)
                                on duplicate key update status = 'picked'
                                """,
                        Map.of("date", date)
                );
                log.info("DateSchedule >> Scheduled crawl for [%s] events.".formatted(date));
            } catch (Exception e) {
                log.log(Level.WARNING, "DateSchedule: failed to send tomorrow date to queue: " + date, e);
            }
        }
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
        var sentDates = new ArrayList<String>(dates.size());
        for (String date : dates) {
            try {
                dateProducer.sendDate(date);
                sentDates.add(date);
            } catch (Exception e) {
                log.log(Level.WARNING, "DateSchedule: failed to send date to queue: " + date, e);
            }
        }
        if (sentDates.isEmpty()) {
            return;
        }
        jdbcTemplate.batchUpdate(
                "update crawl_date set status = 'picked' where date = :date",
                sentDates.stream()
                        .map(date -> new MapSqlParameterSource("date", date))
                        .toArray(MapSqlParameterSource[]::new)
        );
        log.info("DateSchedule >> Scheduled crawl by date, total sent: " + sentDates.size());
    }
}
