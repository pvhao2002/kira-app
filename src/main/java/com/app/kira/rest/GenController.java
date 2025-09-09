package com.app.kira.rest;

import com.app.kira.producer.DateProducer;
import com.app.kira.util.DateUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
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
        return Map.of("result", "success");
    }

    @GetMapping("date")
    public Object date() {
        dateProducer.sendDate(DateUtil.getTodayDate());
        return Map.of("result", "success");
    }
}
