//package com.queue.kiraqueue.consumer;
//
//import com.queue.kiraqueue.service.CrawDateService;
//import lombok.RequiredArgsConstructor;
//import lombok.extern.java.Log;
//import org.springframework.amqp.rabbit.annotation.RabbitListener;
//import org.springframework.stereotype.Service;
//import org.springframework.util.StringUtils;
//
//import java.util.Arrays;
//import java.util.List;
//
//@Log
//@Service
//@RequiredArgsConstructor
//public class DateConsumer {
//    private final CrawDateService crawDateService;
//    public static final String QUEUE_DATE_TOMORROW = "crawlTomorrowEvent";
//    public static final String QUEUE_DATE = "crawlByDate";
//
//    @RabbitListener(queues = QUEUE_DATE_TOMORROW, concurrency = "1")
//    public void handleDateTomorrow(String date) {
//        if (!StringUtils.hasText(date)) {
//            return;
//        }
//        List<String> dateList = Arrays.stream(date.split(","))
//                .map(String::trim)
//                .filter(StringUtils::hasText)
//                .toList();
//        if (dateList.isEmpty()) {
//            return;
//        }
//        try {
//            crawDateService.crawlDate(dateList);
//        } catch (Exception e) {
//            log.severe("handleDateTomorrow failed: " + e.getMessage());
//            throw e;
//        }
//    }
//
//    @RabbitListener(queues = QUEUE_DATE, concurrency = "1")
//    public void handleDate(String dates) {
//        if (!StringUtils.hasText(dates)) {
//            return;
//        }
//        List<String> dateList = Arrays.stream(dates.split(","))
//                .map(String::trim)
//                .filter(StringUtils::hasText)
//                .toList();
//        if (dateList.isEmpty()) {
//            return;
//        }
//        try {
//            crawDateService.crawlDate(dateList);
//        } catch (Exception e) {
//            log.severe("handleDate failed: " + e.getMessage());
//            throw e;
//        }
//    }
//}
