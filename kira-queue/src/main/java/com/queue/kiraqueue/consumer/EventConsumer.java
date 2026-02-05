package com.queue.kiraqueue.consumer;

import com.queue.kiraqueue.dto.Event;
import com.queue.kiraqueue.dto.RawEventAnalyst;
import com.queue.kiraqueue.service.CrawEventService;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.Map;

@Log
@Service
@RequiredArgsConstructor
public class EventConsumer {
    public static final String QUEUE_EVENT_ODD_TOMORROW = "crawlOddForUpcomingEvent";
    public static final String QUEUE_EVENT_ODD = "event";
    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final CrawEventService eventService;


    @RabbitListener(queues = QUEUE_EVENT_ODD_TOMORROW, concurrency = "1")
    public void handleEventTomorrow(String eventIds) {
        var eventIdList = Arrays.stream(eventIds.split(",")).toList();
        var events = jdbcTemplate.query(
                "select * from events where event_id in (:eventIds)",
                Map.of("eventIds", eventIdList),
                BeanPropertyRowMapper.newInstance(Event.class)
        );
    }

    @RabbitListener(queues = QUEUE_EVENT_ODD, concurrency = "1")
    public void handleEvent(String eventIds) {
        var eventIdList = Arrays.stream(eventIds.split(",")).toList();
        var events = jdbcTemplate.query(
                "select * from event_analyst where event_id in (:eventIds)",
                Map.of("eventIds", eventIdList),
                BeanPropertyRowMapper.newInstance(RawEventAnalyst.class)
        );
    }
}
