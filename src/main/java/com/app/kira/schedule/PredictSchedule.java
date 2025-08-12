package com.app.kira.schedule;

import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

@Log
@Service
@RequiredArgsConstructor
public class PredictSchedule {
    private final NamedParameterJdbcTemplate jdbcTemplate;
}
