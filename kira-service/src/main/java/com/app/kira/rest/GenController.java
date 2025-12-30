package com.app.kira.rest;

import com.app.kira.producer.DateProducer;
import com.app.kira.producer.EventProducer;
import com.app.kira.util.DateUtil;
import com.google.common.collect.Lists;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("gen")
@RequiredArgsConstructor
public class GenController {
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;
    private final DateProducer dateProducer;
    private final EventProducer eventProducer;

    @GetMapping("gen-all-date")
    public Object genAllDate() {
        namedParameterJdbcTemplate.update("""
                update crawl_date
                set status = 'pending'
                where status = 'completed'
                """, Map.of());
        return Map.of("status", "done");
    }

    @GetMapping("upcoming")
    public Object upcoming() {
        List.of(DateUtil.getTodayDate(), DateUtil.getTomorrowDate()).forEach(dateProducer::sendDateTomorrow);
        return Map.of("result", List.of(DateUtil.getTodayDate(), DateUtil.getTomorrowDate()));
    }

    @GetMapping("event-upcoming/{eventId}")
    public Object eventUpcoming(@PathVariable String eventId) {
        eventProducer.sendEventUpcoming(eventId);
        return Map.of("status", "done");
    }

    @GetMapping("gen-all-upcoming")
    public Object genAllUpcoming() {
        var eventIds = namedParameterJdbcTemplate.queryForList("""
                select event_id
                from events
                where event_date > CONVERT_TZ(NOW(), 'SYSTEM', '+07:00')
                """, Map.of(), String.class);

        Lists.partition(eventIds, 100)
                .stream().map(part -> String.join(",", part))
                .forEach(eventProducer::sendEventUpcoming);
        return Map.of("result", List.of(eventIds));
    }

    @GetMapping("date")
    public Object date() {
        dateProducer.sendDate(DateUtil.getTodayDate());
        return Map.of("result", "success");
    }
}
