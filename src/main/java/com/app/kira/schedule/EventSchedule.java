package com.app.kira.schedule;

import com.app.kira.service.CrawEventService;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Service
@Log
@RequiredArgsConstructor
public class EventSchedule {
    private final CrawEventService crawEventService;

    @Scheduled(fixedDelay = 5, timeUnit = TimeUnit.SECONDS, initialDelay = 1)
    public void crawlOddForUpcomingEvent() {
        crawEventService.processOddForUpcomingEvent();
    }

    @Scheduled(fixedDelay = 10, timeUnit = TimeUnit.SECONDS, initialDelay = 10)
    public void event() {
        crawEventService.processCrawEvent();
    }
}
