package com.queue.kiraqueue.consumer;

import com.queue.kiraqueue.service.CrawDateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;

import java.util.Arrays;

@Log
@Service
@RequiredArgsConstructor
public class DateConsumer {
    private final CrawDateService crawDateService;
    public static final String QUEUE_DATE_TOMORROW = "crawlTomorrowEvent";
    public static final String QUEUE_DATE = "crawlByDate";

    @RabbitListener(queues = QUEUE_DATE_TOMORROW, concurrency = "1")
    public void handleDateTomorrow(String date) {
        crawDateService.crawlTomorrowEventToPredict(date);
    }

    @RabbitListener(queues = QUEUE_DATE, concurrency = "1")
    public void handleDate(String dates) {
        var dateList = Arrays.stream(dates.split(",")).toList();
        crawDateService.crawlByDateToAnalyst(dateList);
    }
}
