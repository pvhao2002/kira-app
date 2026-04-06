package com.db.kiragateway.service;

import com.db.kiragateway.dto.*;
import com.db.kiragateway.repository.CrawlCallbackRepository;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.logging.Logger;

@Service
public class CrawlCallbackService {

    private static final Logger log = Logger.getLogger(CrawlCallbackService.class.getName());
    private final CrawlCallbackRepository repo;

    public CrawlCallbackService(CrawlCallbackRepository repo) {
        this.repo = repo;
    }

    public void updateCrawlDateStatus(String date, CrawlDateStatusRequest req) {
        repo.updateCrawlDateStatus(date, req.status(), req.totalEvents(), req.message());
    }

    @Transactional
    public void persistCrawledEvents(List<CrawledEventDTO> events) {
        if (events == null || events.isEmpty()) return;

        // 1. Unique leagues
        Map<String, MapSqlParameterSource> leagueByName = new LinkedHashMap<>();
        for (var e : events) {
            leagueByName.putIfAbsent(e.leagueName(),
                    new MapSqlParameterSource()
                            .addValue("league_name", e.leagueName())
                            .addValue("logo_url", e.leagueUrl())
                            .addValue("country", e.countryName()));
        }
        repo.batchInsertLeagues(new ArrayList<>(leagueByName.values()));

        // 2. Unique teams
        Map<String, MapSqlParameterSource> teamByName = new LinkedHashMap<>();
        for (var e : events) {
            teamByName.putIfAbsent(e.homeName(),
                    new MapSqlParameterSource()
                            .addValue("team_name", e.homeName())
                            .addValue("logo_url", e.homeUrl()));
            teamByName.putIfAbsent(e.awayName(),
                    new MapSqlParameterSource()
                            .addValue("team_name", e.awayName())
                            .addValue("logo_url", e.awayUrl()));
        }
        repo.batchInsertTeams(new ArrayList<>(teamByName.values()));

        // 3. Bulk select IDs
        var leagueIds = repo.selectLeagueIdsByName(new ArrayList<>(leagueByName.keySet()));
        var teamIds = repo.selectTeamIdsByName(new ArrayList<>(teamByName.keySet()));

        // 4. Batch insert events
        var eventParams = events.stream()
                .map(e -> new MapSqlParameterSource()
                        .addValue("exid", e.externalId())
                        .addValue("league_id", leagueIds.get(e.leagueName()))
                        .addValue("home_id", teamIds.get(e.homeName()))
                        .addValue("away_id", teamIds.get(e.awayName()))
                        .addValue("event_name", e.eventName())
                        .addValue("event_date", e.eventDate())
                        .addValue("status", e.providerStatus())
                        .addValue("link", e.detailLink()))
                .toList();
        repo.batchInsertEvents(eventParams);

        // 5. Bulk select event IDs
        var exIds = events.stream().map(CrawledEventDTO::externalId).toList();
        var eventIdMap = repo.selectEventIdsByExternalId(exIds);

        // 6. Batch insert event_result
        var resultParams = events.stream()
                .map(e -> {
                    Long eventId = eventIdMap.get(e.externalId());
                    return new MapSqlParameterSource()
                            .addValue("eventId", eventId)
                            .addValue("htHomeGoal", e.htHomeScore())
                            .addValue("htAwayGoal", e.htAwayScore())
                            .addValue("ftHomeGoal", e.ftHomeScore())
                            .addValue("ftAwayGoal", e.ftAwayScore())
                            .addValue("ftHomeCorner", e.homeCorner())
                            .addValue("ftAwayCorner", e.awayCorner())
                            .addValue("htResult", e.htResult())
                            .addValue("htGoalStr", e.htScoreStr())
                            .addValue("ftResult", e.ftResult())
                            .addValue("ftGoalStr", e.ftScoreStr());
                })
                .toList();
        repo.batchInsertEventResults(resultParams);

        log.info("persistCrawledEvents: inserted %d events".formatted(events.size()));
    }

    public Optional<EventInfoResponse> getEventInfo(long eventId) {
        return repo.findEventInfo(eventId);
    }

    @Transactional
    public void persistEventStats(long eventId, CrawlStatsRequest req) {
        repo.updateEventStats(eventId, req.htStats(), req.ftStats());
    }

    @Transactional
    public void deleteEventOdds(long eventId) {
        repo.deleteOddsForEvent(eventId);
    }

    @Transactional
    public void persistEventOdds(long eventId, CrawlOddsRequest req) {
        repo.persistOddsForMarket(eventId, req.market(), req.timeline());
    }

    public void reportCrawlFail(long eventId, CrawlFailRequest req) {
        repo.insertCrawlFail(eventId, req.type(), req.message());
    }

    public void clearCrawlFail(long eventId) {
        repo.deleteCrawlFail(eventId);
    }
}
