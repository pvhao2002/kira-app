package com.app.kira.rest;

import com.app.kira.model.PredictEventResponse;
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
@RequestMapping("/predict")
public class PredictEventController {
    private final NamedParameterJdbcTemplate jdbcTemplate;
    private static final String SQL_GET_TODAY_EVENT = """
            select p.predict_id
                 , p.event_name
                 , p.event_date
                 , p.league_name
                 , p.event_link
                 , e.home_logo
                 , e.away_logo
                 , e.first_hdc
                 , e.first_home_odds
                 , e.first_away_odds
                 , e.last_hdc
                 , e.last_home_odds
                 , e.last_away_odds
                 , e.first_ou
                 , e.first_over_odds
                 , e.first_under_odds
                 , e.last_ou
                 , e.last_over_odds
                 , e.last_under_odds
            
                 , pd.predict_type
                 , pd.hdc_pick
                 , pd.ou_pick
                 , pd.predict_score
                 , pd.hdc_count
                 , pd.ou_count
                 , pd.match_count
            from predict p
                     inner join predict_detail pd on pd.predict_id = p.predict_id
                     inner join events e on e.event_name = p.event_name and e.event_date = p.event_date
                     inner join kira_league kl on e.league_id = kl.league_id
            where true
              and p.event_date >= CONVERT_TZ(NOW(), '+00:00', '+07:00') - INTERVAL 1 HOUR
              and e.first_hdc is not null
            order by p.event_date, kl.is_main desc
            """;

    @GetMapping
    public Object getTodayEvent() {
        var events = jdbcTemplate.query(SQL_GET_TODAY_EVENT, BeanPropertyRowMapper.newInstance(PredictEventResponse.PredictEvent.class));
        if (events.isEmpty()) {
            return Collections.emptyList();
        }

        return events.stream()
                .collect(Collectors.groupingBy(PredictEventResponse.PredictEvent::getEventDate, LinkedHashMap::new, Collectors.toList()))
                .entrySet()
                .stream()
                .map(PredictEventResponse::new)
                .toList();
    }
}
