package com.queue.kiraqueue.consumer;

import com.queue.kiraqueue.service.CrawEventServiceV2;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.logging.Level;

@Log
@Service
@RequiredArgsConstructor
public class EventConsumer {
    public static final String QUEUE_EVENT_ODD_TOMORROW = "crawlOddForUpcomingEvent";
    public static final String QUEUE_EVENT_ODD = "event";

    private final CrawEventServiceV2 crawEventServiceV2;

    @RabbitListener(queues = QUEUE_EVENT_ODD_TOMORROW, concurrency = "1")
    public void handleEventTomorrow(String eventIds) {
        processEventIds("handleEventTomorrow", eventIds);
    }

    @RabbitListener(queues = QUEUE_EVENT_ODD, concurrency = "1")
    public void handleEvent(String eventIds) {
        processEventIds("handleEvent", eventIds);
        // sleep for 5 second to avoid overwhelming the crawl service when there are many events
        try {
            Thread.sleep(5000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private void processEventIds(String handler, String eventIds) {
        if (!StringUtils.hasText(eventIds)) {
            return;
        }
        for (String raw : eventIds.split(",")) {
            String id = raw.trim();
            if (!StringUtils.hasText(id)) {
                continue;
            }
            try {
                long eventId = Long.parseLong(id);
                crawEventServiceV2.processEvent(eventId);
            } catch (NumberFormatException e) {
                log.log(Level.WARNING, handler + ": invalid event id \"" + id + "\"");
            } catch (Exception e) {
                log.log(Level.SEVERE, handler + ": failed for id " + id, e);
            }
        }
    }
}
