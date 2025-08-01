package com.app.kira.schedule;

import com.app.kira.service.CrawDateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Log
@Service
@RequiredArgsConstructor
public class DateSchedule {
    private final CrawDateService crawDateService;

    @Scheduled(cron = "0 0 5,12,19 * * ?", zone = "Asia/Ho_Chi_Minh")
    @Retryable(retryFor = Exception.class, backoff = @Backoff(delay = 60_000, multiplier = 2))
    public void crawlTomorrowEvent() {
        crawDateService.crawlTomorrowEventToPredict();
    }

    @Scheduled(cron = "0 0 3 * * *", zone = "Asia/Ho_Chi_Minh") // Every day at midnight
    public void crawlByDate() {
        crawDateService.crawlByDateToAnalyst();
    }
}
