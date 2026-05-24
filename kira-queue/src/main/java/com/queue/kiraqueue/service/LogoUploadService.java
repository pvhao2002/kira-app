package com.queue.kiraqueue.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.queue.kiraqueue.config.R2Properties;
import com.queue.kiraqueue.dto.LogoUploadMessage;
import com.queue.kiraqueue.r2.LogoImageDownloader;
import com.queue.kiraqueue.r2.R2QuotaGuard;
import com.queue.kiraqueue.r2.R2StorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.logging.Level;

@Log
@Service
@RequiredArgsConstructor
public class LogoUploadService {

    private static final String SQL_SELECT_LEAGUE = """
            select league_id, logo_url, logo
            from leagues
            where league_id = :id
            """;

    private static final String SQL_SELECT_TEAM = """
            select team_id, logo_url, logo
            from teams
            where team_id = :id
            """;

    private static final String SQL_UPDATE_LEAGUE = """
            update leagues set logo = :logo where league_id = :id
            """;

    private static final String SQL_UPDATE_TEAM = """
            update teams set logo = :logo where team_id = :id
            """;

    private final ObjectMapper objectMapper;
    private final R2Properties r2Properties;
    private final ObjectProvider<R2StorageService> r2StorageService;
    private final R2QuotaGuard quotaGuard;
    private final NamedParameterJdbcTemplate jdbcTemplate;

    public void process(String payload) {
        LogoUploadMessage message;
        try {
            message = objectMapper.readValue(payload, LogoUploadMessage.class);
        } catch (Exception ex) {
            log.log(Level.WARNING, "Invalid logo_queue message: " + payload, ex);
            return;
        }
        if (message == null || message.id() <= 0) {
            log.warning("Invalid logo_queue message id: " + payload);
            return;
        }
        if (!message.isLeague() && !message.isTeam()) {
            log.warning("Unknown logo_queue entity: " + message.entity());
            return;
        }
        if (!r2Properties.isConfigured()) {
            log.fine("R2 not configured; skipping logo upload for " + payload);
            return;
        }
        if (!quotaGuard.canUpload()) {
            log.log(Level.WARNING, "R2 free tier quota exceeded; skipping logo upload for {0} id={1}"
                    .formatted(message.entity(), message.id()));
            return;
        }
        var storage = r2StorageService.getIfAvailable();
        if (storage == null) {
            log.warning("R2 S3 client not available; skipping logo upload for " + payload);
            return;
        }

        try {
            if (message.isLeague()) {
                processLeague(message.id(), storage);
            } else {
                processTeam(message.id(), storage);
            }
        } catch (Exception ex) {
            log.log(Level.WARNING, "Logo upload failed for " + payload, ex);
        }
    }

    private void processLeague(int leagueId, R2StorageService storage) throws Exception {
        var row = jdbcTemplate.query(
                SQL_SELECT_LEAGUE,
                new MapSqlParameterSource("id", leagueId),
                (rs, rn) -> new LogoRow(rs.getString("logo_url"), rs.getString("logo"))
        );
        if (row.isEmpty()) {
            return;
        }
        uploadIfNeeded("league", leagueId, row.getFirst(), storage, SQL_UPDATE_LEAGUE);
    }

    private void processTeam(int teamId, R2StorageService storage) throws Exception {
        var row = jdbcTemplate.query(
                SQL_SELECT_TEAM,
                new MapSqlParameterSource("id", teamId),
                (rs, rn) -> new LogoRow(rs.getString("logo_url"), rs.getString("logo"))
        );
        if (row.isEmpty()) {
            return;
        }
        uploadIfNeeded("team", teamId, row.getFirst(), storage, SQL_UPDATE_TEAM);
    }

    private void uploadIfNeeded(
            String entity,
            int id,
            LogoRow row,
            R2StorageService storage,
            String updateSql
    ) throws Exception {
        if (StringUtils.hasText(row.logo())) {
            return;
        }
        if (!StringUtils.hasText(row.logoUrl())) {
            return;
        }
        var downloaded = LogoImageDownloader.download(row.logoUrl());
        var objectKey = "logos/" + entity + "s/" + id + "." + downloaded.extension();
        var publicUrl = storage.upload(objectKey, downloaded.bytes(), downloaded.contentType());
        jdbcTemplate.update(
                updateSql,
                new MapSqlParameterSource("id", id).addValue("logo", publicUrl)
        );
        quotaGuard.recordUpload(downloaded.bytes().length);
        log.info("Uploaded logo for " + entity + " id=" + id + " -> " + publicUrl);
    }

    private record LogoRow(String logoUrl, String logo) {
    }
}
