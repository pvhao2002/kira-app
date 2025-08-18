package com.app.kira.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class PredictService {
    private final NamedParameterJdbcTemplate jdbcTemplate;

}
