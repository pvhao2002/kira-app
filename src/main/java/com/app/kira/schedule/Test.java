package com.app.kira.schedule;

import com.app.kira.dto.predict.ProxyDTO;
import com.app.kira.service.CrawDateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.logging.Level;

@Log
@Service
@RequiredArgsConstructor
public class Test {
    private final CrawDateService crawDateService;
    private final NamedParameterJdbcTemplate jdbcTemplate;

    @Transactional
    public void process() throws InterruptedException {
        var sql = """
                select *
                   from proxy
                   limit 3
                   for share skip locked
                """;
        var r = jdbcTemplate.query(sql, (rs, i) -> new ProxyDTO(rs));
        // log all proxies with username and port in array
        log.log(Level.INFO, "Proxies: {0}", r.stream()
                .map(p -> String.format("%s:%d (%s)", p.getServer(), p.getPort(), p.getUsername()))
                .toList());
        Thread.sleep(10000);
        for(var proxy : r) {
            log.log(Level.INFO, "Processing proxy: {0}", proxy);

            crawDateService.update(proxy);
            Thread.sleep(5000);
        }
    }
}
