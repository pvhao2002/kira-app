package com.app.kira.schedule;

import com.app.kira.service.CrawDateService;
import com.app.kira.util.DateUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;

@Log
@Service
@RequiredArgsConstructor
public class DateSchedule {
    private final CrawDateService crawDateService;

    @Scheduled(cron = "0 31 4,8,12,15,18,20,1 * * *", zone = "Asia/Ho_Chi_Minh")
    @Retryable(retryFor = Exception.class, backoff = @Backoff(delay = 60_000, multiplier = 2))
    public void crawlTomorrowEvent() {
        for (var date : List.of(DateUtil.getTodayDate(), DateUtil.getTomorrowDate())) {
            log.info("Crawling events for date: " + date);
            crawDateService.crawlTomorrowEventToPredict(date);
        }
    }

    @Scheduled(cron = "0 0 3 * * *", zone = "Asia/Ho_Chi_Minh")
    public void crawlByDate() {
        crawDateService.crawlByDateToAnalyst();
    }
}
