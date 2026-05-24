package com.queue.kiraqueue.amqp;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.queue.kiraqueue.config.RabbitMQConfig;
import com.queue.kiraqueue.dto.LogoUploadMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.logging.Level;

@Log
@Service
@RequiredArgsConstructor
public class LogoUploadProducer {

    private static final String SQL_PENDING_LEAGUES = """
            select league_id
            from leagues
            where league_id in (:ids)
              and logo_url is not null
              and trim(logo_url) <> ''
              and logo is null
            """;

    private static final String SQL_PENDING_TEAMS = """
            select team_id
            from teams
            where team_id in (:ids)
              and logo_url is not null
              and trim(logo_url) <> ''
              and logo is null
            """;

    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;
    private final NamedParameterJdbcTemplate jdbcTemplate;

    public void enqueuePendingLeagues(Collection<Integer> leagueIds) {
        enqueuePendingLeagueIds(leagueIds);
    }

    public void enqueuePendingTeams(Collection<Integer> teamIds) {
        enqueuePendingTeamIds(teamIds);
    }

    private void enqueuePendingLeagueIds(Collection<Integer> ids) {
        enqueuePending(ids, SQL_PENDING_LEAGUES, "league_id", LogoUploadMessage.ENTITY_LEAGUE);
    }

    private void enqueuePendingTeamIds(Collection<Integer> ids) {
        enqueuePending(ids, SQL_PENDING_TEAMS, "team_id", LogoUploadMessage.ENTITY_TEAM);
    }

    private void enqueuePending(Collection<Integer> ids, String sql, String idColumn, String entity) {
        if (CollectionUtils.isEmpty(ids)) {
            return;
        }
        var unique = new HashSet<Integer>();
        for (Integer id : ids) {
            if (id != null && id > 0) {
                unique.add(id);
            }
        }
        if (unique.isEmpty()) {
            return;
        }
        List<Integer> pending = jdbcTemplate.query(
                sql,
                new MapSqlParameterSource("ids", unique),
                (rs, rn) -> rs.getInt(idColumn)
        );
        for (Integer id : pending) {
            publish(entity, id);
        }
    }

    private void publish(String entity, int id) {
        try {
            var json = objectMapper.writeValueAsString(new LogoUploadMessage(entity, id));
            rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE, RabbitMQConfig.ROUTING_KEY_LOGO, json);
        } catch (JsonProcessingException ex) {
            log.log(Level.WARNING, "Failed to enqueue logo upload for " + entity + " id=" + id, ex);
        }
    }
}
