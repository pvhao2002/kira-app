package com.app.kira.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Log
@Service
@RequiredArgsConstructor
public class CorrectService {
    private final NamedParameterJdbcTemplate jdbcTemplate;

    @Transactional
    public void correctLeagueForEventAnalyst() {
        jdbcTemplate.update("""
                insert ignore into kira_league(league_name)
                select distinct league_name
                from event_analyst
                order by league_name
                """, Map.of());
        jdbcTemplate.update("""
                update event_analyst ea
                    inner join kira_league kl on kl.league_name = ea.league_name
                set ea.league_id = kl.league_id
                where ea.league_id is null
                """, Map.of());
        jdbcTemplate.update("""
                update predict ea
                    inner join kira_league kl on kl.league_name = ea.league_name
                set ea.league_id = kl.league_id
                where ea.league_id is null
                """, Map.of());
        jdbcTemplate.update("""
                delete
                from predict
                where event_date < DATE_SUB(CONVERT_TZ(NOW(), '+00:00', '+07:00'), INTERVAL 4 HOUR)
                  and (first_hdc_line is null or last_hdc_line is null)
                """, Map.of());
    }
}
