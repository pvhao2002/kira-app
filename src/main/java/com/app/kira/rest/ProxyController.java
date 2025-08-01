package com.app.kira.rest;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.Map;

@RestController
@RequestMapping("proxy")
@RequiredArgsConstructor
public class ProxyController {
    private final NamedParameterJdbcTemplate jdbcTemplate;


    @PostMapping
    public Object createProxy(@RequestBody String proxy) {
        var listProxy = Arrays.stream(proxy.split("\\R"))
                .map(String::trim)
                .filter(line -> !line.isEmpty())
                .toList();
        listProxy.forEach(e -> {
            var parts = e.split(":");
            if (parts.length == 4) {
                String ip = parts[0].trim();
                int port = Integer.parseInt(parts[1].trim());
                String username = parts[2].trim();
                String password = parts[3].trim();

                String sql = "insert into proxy(address, port, username, password) VALUES (:ip, :port, :username, :password) ON DUPLICATE KEY UPDATE username = values(username), password = values(password)";
                var params = Map.of("ip", ip, "port", port, "username", username, "password", password);
                jdbcTemplate.update(sql, params);
            }
        });
        return "OK";
    }
}
