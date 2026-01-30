package com.queue.kiraqueue.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

@Log
@Service
@RequiredArgsConstructor
public class PredictService {
    private static final String MINUS = "-";
    private static final String HASH = "#";
    private static final String COMMA = ",";

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public void predict(String eventId) {

    }

}
