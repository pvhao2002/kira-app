package com.app.kira.schedule;

import com.app.kira.service.CrawDateService;
import com.app.kira.util.DateUtil;
import com.app.kira.util.PackageNameUtils;
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
    public static final String CRAWL_TOMORROW_METHOD = PackageNameUtils.getCanonicalMethodName(DateSchedule.class, "crawlTomorrowEvent");
    public static final String CRAWL_BY_DATE_METHOD = PackageNameUtils.getCanonicalMethodName(DateSchedule.class, "crawlByDate");
    private final CrawDateService crawDateService;


    @Scheduled(cron = "0 0 1,6,12,15,20,22 * * *", zone = "Asia/Ho_Chi_Minh")
    @Retryable(retryFor = Exception.class, backoff = @Backoff(delay = 60_000, multiplier = 2))
    public void crawlTomorrowEvent() {
        for (var date : List.of(DateUtil.getTodayDate(), DateUtil.getTomorrowDate())) {
            log.info("Crawling events for date: " + date);
            crawDateService.crawlTomorrowEventToPredict(date);
        }
    }

    @Scheduled(cron = "0 0 3,6,10 * * *", zone = "Asia/Ho_Chi_Minh")
    public void crawlByDate() {
        crawDateService.crawlByDateToAnalyst();
    }
}
