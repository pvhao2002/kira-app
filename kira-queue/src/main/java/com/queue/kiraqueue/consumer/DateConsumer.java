package com.queue.kiraqueue.consumer;

import com.queue.kiraqueue.service.CrawDateServiceV2;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Arrays;
import java.util.List;
import java.util.logging.Level;

@Log
@Service
@RequiredArgsConstructor
public class DateConsumer {
    private final CrawDateServiceV2 crawDateServiceV2;
    public static final String QUEUE_DATE_TOMORROW = "crawlTomorrowEvent";
    public static final String QUEUE_DATE = "crawlByDate";

    @RabbitListener(queues = QUEUE_DATE_TOMORROW, concurrency = "1")
    public void handleDateTomorrow(String date) {
        processDates("handleDateTomorrow", date);
    }

    @RabbitListener(queues = QUEUE_DATE, concurrency = "1")
    public void handleDate(String dates) {
        processDates("handleDate", dates);
        // sleep for 5 second to avoid overwhelming the crawl service when there are many dates
        try {
            Thread.sleep(2000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private void processDates(String handler, String dates) {
        if (!StringUtils.hasText(dates)) {
            return;
        }
        List<String> dateList = Arrays.stream(dates.split(","))
                .map(String::trim)
                .filter(StringUtils::hasText)
                .toList();
        if (dateList.isEmpty()) {
            return;
        }
        try {
            crawDateServiceV2.crawlDate(dateList);
        } catch (Exception e) {
            log.log(Level.SEVERE, handler + " failed: " + e.getMessage(), e);
        }
    }
}
