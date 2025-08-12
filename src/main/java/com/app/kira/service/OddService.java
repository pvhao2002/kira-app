package com.app.kira.service;

import com.app.kira.model.EventDTO;
import com.app.kira.model.EventResult;
import com.app.kira.model.analyst.OddAnalyst;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.logging.Level;
import java.util.stream.Collectors;

@Log
@Service
@RequiredArgsConstructor
public class OddService {
    private static final String STATUS_KEY = "status";
    private static final String FAIL_STATUS = "fail";
    private static final String DONE_STATUS = "done";
    private static final String EVENT_ID_KEY = "event_id";
    private static final String SQL_GET_EVENT_AND_ODD = """
            select oa2.event_id
                 , oa2.odd_value
                 , oa2.odd_type
            from odd_analyst oa2
            WHERE (oa2.status = 'pending' OR oa2.status = 'fail')
            LIMIT 120
            for update skip locked
            """;
    private static final String SQL_UPDATE_ODD_ANALYST_STATUS = """
            update odd_analyst
                set status = :status
            where event_id = :event_id
            """;
    private static final String SQL_INSERT_ODD_EVENT = """
            insert into odd_event(event_id, odd_type, odd_date, line, home_odds, draw_odds, away_odds, over_odds, under_odds)
            VALUES (:event_id, :odd_type, :odd_date, :line, :home_odds, :draw_odds, :away_odds, :over_odds, :under_odds)
            ON DUPLICATE KEY UPDATE
                line = VALUES(line),
                home_odds = VALUES(home_odds),
                draw_odds = VALUES(draw_odds),
                away_odds = VALUES(away_odds),
                over_odds = VALUES(over_odds),
                under_odds = VALUES(under_odds)
            """;

    private static final String OPEN_PREMATCH_ODD = """
            update event_analyst ea
                join (select event_id,
                             max(case when odd_date = first_odd_date then home_odds end) as first_home_odds,
                             max(case when odd_date = last_odd_date then home_odds end)  as last_home_odds
                      from (select event_id,
                                   home_odds,
                                   odd_date,
                                   min(odd_date) over (partition by event_id) as first_odd_date,
                                   max(odd_date) over (partition by event_id) as last_odd_date
                            from odd_event
                            where odd_type = 'hdc') ranked
                      group by event_id) home_odd
                on home_odd.event_id = ea.event_id
                join (select event_id,
                             max(case when odd_date = first_odd_date then away_odds end) as first_away_odds,
                             max(case when odd_date = last_odd_date then away_odds end)  as last_away_odds
                      from (select event_id,
                                   away_odds,
                                   odd_date,
                                   min(odd_date) over (partition by event_id) as first_odd_date,
                                   max(odd_date) over (partition by event_id) as last_odd_date
                            from odd_event
                            where odd_type = 'hdc') ranked
                      group by event_id) away_odd
                on away_odd.event_id = ea.event_id
                join (select event_id,
                             max(case when odd_date = first_odd_date then over_odds end) as first_over_odds,
                             max(case when odd_date = last_odd_date then over_odds end)  as last_over_odds
                      from (select event_id,
                                   over_odds,
                                   odd_date,
                                   min(odd_date) over (partition by event_id) as first_odd_date,
                                   max(odd_date) over (partition by event_id) as last_odd_date
                            from odd_event
                            where odd_type = 'ou') ranked
                      group by event_id) over_odd on over_odd.event_id = ea.event_id
                join (select event_id,
                             max(case when odd_date = first_odd_date then under_odds end) as first_under_odds,
                             max(case when odd_date = last_odd_date then under_odds end)  as last_under_odds
                      from (select event_id,
                                   under_odds,
                                   odd_date,
                                   min(odd_date) over (partition by event_id) as first_odd_date,
                                   max(odd_date) over (partition by event_id) as last_odd_date
                            from odd_event
                            where odd_type = 'ou') ranked
                      group by event_id) under_odd on under_odd.event_id = ea.event_id
                join (select event_id,
                             max(case when odd_date = first_odd_date then line end) as first_ou,
                             max(case when odd_date = last_odd_date then line end)  as last_ou
                      from (select event_id,
                                   line,
                                   odd_date,
                                   min(odd_date) over (partition by event_id) as first_odd_date,
                                   max(odd_date) over (partition by event_id) as last_odd_date
                            from odd_event
                            where odd_type = 'ou') ranked
                      group by event_id) ou on ou.event_id = ea.event_id
                join (select event_id,
                             max(case when odd_date = first_odd_date then line end) as first_hdc,
                             max(case when odd_date = last_odd_date then line end)  as last_hdc
                      from (select event_id,
                                   line,
                                   odd_date,
                                   min(odd_date) over (partition by event_id) as first_odd_date,
                                   max(odd_date) over (partition by event_id) as last_odd_date
                            from odd_event
                            where odd_type = 'hdc') ranked
                      group by event_id) hdc on hdc.event_id = ea.event_id
            set ea.first_home_odds  = IFNULL(ea.first_home_odds, home_odd.first_home_odds),
                ea.last_home_odds   = IFNULL(ea.last_home_odds, home_odd.last_home_odds),
                ea.first_away_odds  = IFNULL(ea.first_away_odds, away_odd.first_away_odds),
                ea.last_away_odds   = IFNULL(ea.last_away_odds, away_odd.last_away_odds),
                ea.first_over_odds  = IFNULL(ea.first_over_odds, over_odd.first_over_odds),
                ea.last_over_odds   = IFNULL(ea.last_over_odds, over_odd.last_over_odds),
                ea.first_under_odds = IFNULL(ea.first_under_odds, under_odd.first_under_odds),
                ea.last_under_odds  = IFNULL(ea.last_under_odds, under_odd.last_under_odds),
                ea.first_ou         = IFNULL(ea.first_ou, ou.first_ou),
                ea.last_ou          = IFNULL(ea.last_ou, ou.last_ou),
                ea.first_hdc        = IFNULL(ea.first_hdc, hdc.first_hdc),
                ea.last_hdc         = IFNULL(ea.last_hdc, hdc.last_hdc)
            """;
    private final NamedParameterJdbcTemplate jdbcTemplate;

    @Transactional
    public void processOdds() {
        var result = jdbcTemplate.query(SQL_GET_EVENT_AND_ODD, (rs, i) -> EventDTO.fromResultSet(rs));
        if (result.isEmpty()) {
            return;
        }
        result.stream()
                .collect(Collectors.groupingBy(EventDTO::getEventId))
                .forEach((key, value) -> {
                    log.log(Level.INFO, "OddSchedule >> calculateOdds >> processing event: {0}", key);
                    var param = new MapSqlParameterSource(EVENT_ID_KEY, key);
                    try {
                        var eventResult = new EventResult(value);
                        if (eventResult.getOddsGoal().isEmpty() && eventResult.getOddsHandicap().isEmpty()) {
                            log.log(Level.WARNING, "Handicap and over under odd not found: {0}", key);
                            jdbcTemplate.update(SQL_UPDATE_ODD_ANALYST_STATUS, param.addValue(STATUS_KEY, DONE_STATUS));
                            return;
                        }
                        var odds = eventResult.parseOdd();
                        if (odds.isEmpty()) {
                            log.warning("No odds found for event: " + key);
                            jdbcTemplate.update(SQL_UPDATE_ODD_ANALYST_STATUS, param.addValue(STATUS_KEY, FAIL_STATUS));
                            return;
                        }
                        var paramOdds = odds
                                .stream()
                                .map(OddAnalyst::toParam)
                                .toArray(SqlParameterSource[]::new);
                        jdbcTemplate.batchUpdate(SQL_INSERT_ODD_EVENT, paramOdds);
                        jdbcTemplate.update(SQL_UPDATE_ODD_ANALYST_STATUS, param.addValue(STATUS_KEY, DONE_STATUS));
                    } catch (Exception ex) {
                        log.log(Level.WARNING, "OddSchedule >> calculateOdds >> exception with event %s:".formatted(key), ex);
                        jdbcTemplate.update(SQL_UPDATE_ODD_ANALYST_STATUS, param.addValue(STATUS_KEY, FAIL_STATUS));
                    }
                });
    }

    @Transactional
    public void correctOddMovement() {
        log.info("Opening prematch odds...");
        jdbcTemplate.update(OPEN_PREMATCH_ODD, new java.util.HashMap<>());
        log.info("Data correction completed.");
    }
}
