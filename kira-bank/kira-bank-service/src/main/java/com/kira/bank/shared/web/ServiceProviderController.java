package com.kira.bank.shared.web;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

import static com.kira.bank.shared.web.ApiTypes.PageMeta;
import static com.kira.bank.shared.web.ApiTypes.PageResponse;

@RestController
@RequestMapping("/api/v1/service-providers")
@RequiredArgsConstructor
public class ServiceProviderController {
    private final JdbcTemplate jdbc;

    @GetMapping
    Object list(@PageableDefault(size = 100, sort = "name") Pageable pageable) {
        long total = jdbc.queryForObject(
                "select count(*) from service_providers where active=true and deleted_at is null",
                Long.class
        );
        var data = jdbc.query(
                "select id, name from service_providers where active=true and deleted_at is null order by name limit ? offset ?",
                (rs, row) -> Map.<String, Object>of("id", rs.getLong("id"), "name", rs.getString("name")),
                pageable.getPageSize(),
                pageable.getOffset()
        );
        int totalPages = total == 0 ? 0 : (int) Math.ceil((double) total / pageable.getPageSize());
        return new PageResponse<>(data, new PageMeta(pageable.getPageNumber(), pageable.getPageSize(), total, totalPages));
    }
}
