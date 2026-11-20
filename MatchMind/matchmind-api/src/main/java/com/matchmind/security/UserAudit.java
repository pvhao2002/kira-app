package com.matchmind.security;

import com.matchmind.shared.ApiTypes.PageResponse;
import com.matchmind.shared.Paging;
import com.matchmind.shared.Sql;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Who changed which account and how (role, status, password reset, unlock). Never stores passwords or tokens. */
@Component
@RequiredArgsConstructor
public class UserAudit {
    private static final Logger log = LoggerFactory.getLogger(UserAudit.class);
    private final NamedParameterJdbcTemplate jdbc;

    public void record(Principals.UserPrincipal actor, User target, String action, String oldValue, String newValue,
                       String clientIp) {
        jdbc.update("""
            INSERT INTO user_audit (actor_id, actor_username, target_id, target_username, action, old_value, new_value, client_ip)
            VALUES (:actorId, :actor, :targetId, :target, :action, :oldValue, :newValue, :ip)
            """, new MapSqlParameterSource().addValue("actorId", actor == null ? null : actor.id())
            .addValue("actor", actor == null ? null : actor.username()).addValue("targetId", target.getId())
            .addValue("target", target.getUsername()).addValue("action", action).addValue("oldValue", oldValue)
            .addValue("newValue", newValue).addValue("ip", clientIp));
        log.info("User audit actor={} target={} action={} {}->{}", actor == null ? "-" : actor.username(),
            target.getUsername(), action, oldValue, newValue);
    }

    public PageResponse<Map<String, Object>> list(UUID userId, Integer page, Integer size) {
        int pg = Paging.page(page), sz = Paging.size(size);
        Sql.Where w = new Sql.Where().and("target_id = :userId", "userId", userId);
        long total = jdbc.queryForObject("SELECT count(*) FROM user_audit" + w.sql(), w.params, Long.class);
        Paging.limit(w.params, pg, sz);
        List<Map<String, Object>> rows = jdbc.query("""
            SELECT id AS "id", at AS "at", actor_username AS "actor", target_id AS "targetId",
                   target_username AS "target", action AS "action", old_value AS "oldValue", new_value AS "newValue",
                   client_ip AS "clientIp"
            FROM user_audit""" + w.sql() + " ORDER BY at DESC, id LIMIT :limit OFFSET :offset", w.params, Sql.ROW);
        return Paging.response(rows, pg, sz, total);
    }
}
