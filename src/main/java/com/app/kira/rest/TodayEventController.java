package com.app.kira.rest;

import com.app.kira.model.EventDTO;
import com.app.kira.model.EventResult;
import com.app.kira.model.TodayEventResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.stream.Collectors;

@Log
@RestController
@RequiredArgsConstructor
@RequestMapping("/today-event")
public class TodayEventController {
    private final NamedParameterJdbcTemplate jdbcTemplate;
    private static final String SQL_GET_TODAY_EVENT = """
            select e.event_id
                 , event_name
                 , event_date
                 , l.league_name
                 , detail_link as link
                 , odd_type
                 , odd_value
            from events e
                     inner join kira_league l on l.league_id = e.league_id
                     inner join odds o on o.event_id = e.event_id
            where true
              and event_date > CONVERT_TZ(NOW(), '+00:00', '+07:00')
                and o.odd_type <> '1x2'
                and o.odd_value <> '[]'
            order by l.is_main desc, e.event_date
            """;

    @GetMapping
    public Object getTodayEvent() {
        var events = jdbcTemplate.query(SQL_GET_TODAY_EVENT, (rs, i) -> new EventDTO(rs));
        if (events.isEmpty()) {
            return Collections.emptyList();
        }
        var eventResults = events
                .stream()
                .collect(Collectors.groupingBy(EventDTO::getEventId, LinkedHashMap::new, Collectors.toList()))
                .entrySet()
                .stream()
                .map(EventResult::new)
                .toList();
        var result = eventResults
                .stream()
                .collect(Collectors.groupingBy(EventResult::getLeagueName, LinkedHashMap::new, Collectors.toList()))
                .entrySet()
                .stream().map(entry -> new TodayEventResponse(entry.getKey(), entry.getValue()))
                .toList();


        return result;
    }
}
