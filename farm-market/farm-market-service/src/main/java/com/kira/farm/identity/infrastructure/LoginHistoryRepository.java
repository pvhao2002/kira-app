package com.kira.farm.identity.infrastructure;

import com.kira.farm.shared.infrastructure.ClientIpResolver.Resolved;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;

@Repository
@RequiredArgsConstructor
public class LoginHistoryRepository {
    private final JdbcTemplate jdbc;

    public void insert(Long userId, String clientIp, Resolved server, String userAgent) {
        jdbc.update("INSERT INTO login_history(user_id,client_ip,server_ip,ip_source,user_agent,created_at) VALUES (?,?,?,?,?,?)",
            userId, clientIp, server.ip(), server.source(), userAgent, Timestamp.from(Instant.now()));
    }
}
