package com.matchmind.match;

import com.matchmind.shared.ApiException;
import com.matchmind.shared.ApiTypes.PageResponse;
import com.matchmind.shared.Paging;
import com.matchmind.shared.Sql;
import com.matchmind.shared.TeamNames;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Array;
import java.sql.SQLException;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Cross-provider match identity (UX-047). A fixture groups the matches rows of one real game. New matches auto-link
 * on ingest to the fixture with the same normalised teams ({@link TeamNames}) and a kick-off within ±6 h; league is
 * only a tie-breaker. Admins merge, unlink and backfill. Only {@code matches.fixture_id} and the fixture tables
 * change; every move writes one append-only {@code fixture_link_history} row. Predictions and settlement are untouched.
 */
@Service
@RequiredArgsConstructor
public class FixtureService {
    static final Duration LINK_WINDOW = Duration.ofHours(6);
    static final Duration SUGGEST_WINDOW = Duration.ofHours(24);
    static final double SIMILAR = 0.5;
    /** ponytail: suggestions scan the latest 2000 fixtures in memory; add a from/to filter if that stops covering the backlog. */
    static final int SUGGEST_SCAN = 2000;

    private final NamedParameterJdbcTemplate jdbc;

    public record MergeRequest(@NotNull @Size(min = 2, max = 20) List<@NotNull UUID> matchIds,
                               @NotBlank @Size(max = 500) String reason) {
    }

    /** Links a just-ingested match; a no-op when it already has a fixture. Runs inside the ingest transaction. */
    @Transactional
    public UUID linkOnIngest(Match m) {
        if (m.getFixtureId() != null) return m.getFixtureId();
        return link(m.getId(), m.getHomeTeam(), m.getAwayTeam(), m.getStartTime(), m.getLeague(), "AUTO", null);
    }

    private UUID link(UUID matchId, String home, String away, Instant start, String league, String source, UUID actor) {
        String h = TeamNames.normalize(home), a = TeamNames.normalize(away);
        MapSqlParameterSource p = new MapSqlParameterSource("h", h).addValue("a", a).addValue("league", league)
            .addValue("key", h + "|" + a)
            .addValue("start", start.atOffset(ZoneOffset.UTC))
            .addValue("from", start.minus(LINK_WINDOW).atOffset(ZoneOffset.UTC))
            .addValue("to", start.plus(LINK_WINDOW).atOffset(ZoneOffset.UTC));
        // Two first callbacks for one game (two providers) serialise here, so they create one fixture, never two.
        jdbc.queryForObject("SELECT 1 FROM pg_advisory_xact_lock(hashtext(:key))", p, Integer.class);
        UUID fixture = jdbc.queryForList("""
            SELECT id FROM fixtures WHERE norm_home = :h AND norm_away = :a AND start_time BETWEEN :from AND :to
            ORDER BY (mm_fold(league) = mm_fold(CAST(:league AS text))) DESC NULLS LAST,
                     abs(extract(epoch FROM start_time - :start)), created_at, id
            LIMIT 1
            """, p, UUID.class).stream().findFirst().orElseGet(() -> create(h, a, start, league, actor));
        move(matchId, null, fixture, source, null, actor);
        return fixture;
    }

    private UUID create(String normHome, String normAway, Instant start, String league, UUID actor) {
        return jdbc.queryForObject("""
            INSERT INTO fixtures (norm_home, norm_away, start_time, league, created_by)
            VALUES (:h, :a, :start, :league, :actor) RETURNING id
            """, new MapSqlParameterSource("h", normHome).addValue("a", normAway)
            .addValue("start", start.atOffset(ZoneOffset.UTC)).addValue("league", league).addValue("actor", actor), UUID.class);
    }

    private void move(UUID matchId, UUID from, UUID to, String source, String reason, UUID actor) {
        MapSqlParameterSource p = new MapSqlParameterSource("m", matchId).addValue("from", from).addValue("to", to)
            .addValue("source", source).addValue("reason", reason == null ? null : reason.trim()).addValue("actor", actor);
        jdbc.update("UPDATE matches SET fixture_id = :to WHERE id = :m", p);
        jdbc.update("""
            INSERT INTO fixture_link_history (match_id, from_fixture_id, to_fixture_id, source, reason, changed_by)
            VALUES (:m, :from, :to, :source, :reason, :actor)
            """, p);
    }

    /**
     * Moves the listed matches and every sibling of their fixtures into the oldest of those fixtures. Results are not
     * touched: members whose results differ show {@code resultMismatch}.
     */
    @Transactional
    public Map<String, Object> merge(MergeRequest r, UUID actor) {
        List<UUID> ids = List.copyOf(new LinkedHashSet<>(r.matchIds()));
        if (ids.size() < 2) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Request validation failed",
                Map.of("matchIds", "name at least 2 different matches"));
        }
        MapSqlParameterSource p = new MapSqlParameterSource("ids", ids);
        // Locked in id order, like result propagation, so concurrent merges and results cannot deadlock.
        List<Map<String, Object>> rows = jdbc.queryForList("""
            SELECT id, fixture_id, home_team, away_team, start_time, league FROM matches
            WHERE id IN (:ids) OR fixture_id IN (SELECT x.fixture_id FROM matches x WHERE x.id IN (:ids))
            ORDER BY id FOR UPDATE
            """, p);
        Set<Object> found = new HashSet<>();
        rows.forEach(row -> found.add(row.get("id")));
        if (!found.containsAll(ids)) throw ApiException.notFound("MATCH_NOT_FOUND", "Match not found");
        List<Object> fixtures = rows.stream().map(row -> row.get("fixture_id")).filter(Objects::nonNull).distinct().toList();
        UUID target = fixtures.isEmpty() ? null : jdbc.queryForObject(
            "SELECT id FROM fixtures WHERE id IN (:f) ORDER BY created_at, id LIMIT 1", new MapSqlParameterSource("f", fixtures), UUID.class);
        if (target == null) {
            Map<String, Object> first = rows.stream().filter(row -> row.get("id").equals(ids.getFirst())).findFirst().orElseThrow();
            target = create(TeamNames.normalize((String) first.get("home_team")), TeamNames.normalize((String) first.get("away_team")),
                ((java.sql.Timestamp) first.get("start_time")).toInstant(), (String) first.get("league"), actor);
        }
        for (Map<String, Object> row : rows) {
            if (!target.equals(row.get("fixture_id"))) {
                move((UUID) row.get("id"), (UUID) row.get("fixture_id"), target, "ADMIN_MERGE", r.reason(), actor);
            }
        }
        return view(target);
    }

    /** Gives the match a fresh fixture of its own. A no-op when it already is the only member of its fixture. */
    @Transactional
    public void unlink(UUID matchId, String reason, UUID actor) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, fixture_id, home_team, away_team, start_time, league FROM matches WHERE id = :id FOR UPDATE",
            new MapSqlParameterSource("id", matchId));
        if (rows.isEmpty()) throw ApiException.notFound("MATCH_NOT_FOUND", "Match not found");
        Map<String, Object> m = rows.getFirst();
        UUID from = (UUID) m.get("fixture_id");
        if (from != null && jdbc.queryForObject("SELECT count(*) FROM matches WHERE fixture_id = :f AND id <> :id",
            new MapSqlParameterSource("f", from).addValue("id", matchId), Long.class) == 0) return;
        UUID fresh = create(TeamNames.normalize((String) m.get("home_team")), TeamNames.normalize((String) m.get("away_team")),
            ((java.sql.Timestamp) m.get("start_time")).toInstant(), (String) m.get("league"), actor);
        move(matchId, from, fresh, "ADMIN_UNLINK", reason, actor);
    }

    /**
     * One-off for rows that predate the fixture layer: links every match without a fixture, oldest first. Idempotent.
     * ponytail: one transaction over all unlinked rows; batch it if the table is ever large when this runs.
     */
    @Transactional
    public Map<String, Object> backfill(UUID actor) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
            SELECT id, home_team, away_team, start_time, league FROM matches WHERE fixture_id IS NULL
            ORDER BY created_at, id FOR UPDATE
            """, Map.of());
        for (Map<String, Object> m : rows) {
            link((UUID) m.get("id"), (String) m.get("home_team"), (String) m.get("away_team"),
                ((java.sql.Timestamp) m.get("start_time")).toInstant(), (String) m.get("league"), "BACKFILL", actor);
        }
        return Map.of("linked", rows.size());
    }

    /** The fixture with its members; {@code resultMismatch} when visible FINISHED members have different scores. */
    @Transactional(readOnly = true)
    public Map<String, Object> view(UUID fixtureId) {
        List<Map<String, Object>> members = jdbc.query("""
            SELECT m.id AS "matchId", m.provider_id AS "providerId", pv.name AS "providerName",
                   m.external_match_id AS "externalMatchId", m.league AS "league", m.home_team AS "homeTeam",
                   m.away_team AS "awayTeam", m.start_time AS "startTime", m.status AS "status",
                   m.final_home_score AS "finalHomeScore", m.final_away_score AS "finalAwayScore", m.archived_at AS "archivedAt"
            FROM matches m JOIN providers pv ON pv.id = m.provider_id
            WHERE m.fixture_id = :f ORDER BY m.created_at, m.id
            """, new MapSqlParameterSource("f", fixtureId), Sql.ROW);
        long scores = members.stream()
            .filter(m -> "FINISHED".equals(m.get("status")) && m.get("archivedAt") == null)
            .map(m -> m.get("finalHomeScore") + "-" + m.get("finalAwayScore")).distinct().count();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", fixtureId);
        out.put("members", members);
        out.put("resultMismatch", scores > 1);
        return out;
    }

    private record Group(Object key, Map<String, Object> rep, Instant start, String home, String away, Set<Object> unlinkedFrom) {
    }

    /**
     * Pairs of different fixtures (an unlinked match counts as its own) within ±24 h whose teams are equal after
     * normalisation or similar by trigrams, best first. A pair an admin separated with an unlink is not suggested.
     */
    @Transactional(readOnly = true)
    public PageResponse<Map<String, Object>> suggestions(Integer page, Integer size) {
        int pg = Paging.page(page), sz = Paging.size(size);
        List<Group> groups = jdbc.query("""
            SELECT * FROM (
                SELECT DISTINCT ON (COALESCE(m.fixture_id, m.id)) COALESCE(m.fixture_id, m.id) AS "fixtureId",
                       m.id AS "matchId", pv.name AS "providerName", m.external_match_id AS "externalMatchId",
                       m.league AS "league", m.home_team AS "homeTeam", m.away_team AS "awayTeam", m.start_time AS "startTime",
                       m.status AS "status",
                       ARRAY(SELECT h.from_fixture_id FROM fixture_link_history h JOIN matches y ON y.id = h.match_id
                             WHERE h.source = 'ADMIN_UNLINK' AND COALESCE(y.fixture_id, y.id) = COALESCE(m.fixture_id, m.id)
                               AND h.from_fixture_id IS NOT NULL) AS unlinked_from
                FROM matches m JOIN providers pv ON pv.id = m.provider_id
                WHERE m.archived_at IS NULL
                ORDER BY COALESCE(m.fixture_id, m.id), m.created_at, m.id) g
            ORDER BY "startTime" DESC LIMIT :scan
            """, new MapSqlParameterSource("scan", SUGGEST_SCAN), (rs, i) -> {
            Map<String, Object> rep = Sql.ROW.mapRow(rs, i);
            Object unlinked = rep.remove("unlinked_from");
            Set<Object> from = new HashSet<>();
            if (unlinked instanceof Array arr) {
                try {
                    from.addAll(List.of((Object[]) arr.getArray()));
                } catch (SQLException e) {
                    throw new IllegalStateException(e);
                }
            }
            return new Group(rep.get("fixtureId"), rep, (Instant) rep.get("startTime"),
                TeamNames.normalize((String) rep.get("homeTeam")), TeamNames.normalize((String) rep.get("awayTeam")), from);
        });
        groups.sort(Comparator.comparing(Group::start));
        List<Map<String, Object>> pairs = new ArrayList<>();
        for (int i = 0; i < groups.size(); i++) {
            Group a = groups.get(i);
            for (int j = i + 1; j < groups.size() && !groups.get(j).start().isAfter(a.start().plus(SUGGEST_WINDOW)); j++) {
                Group b = groups.get(j);
                if (a.unlinkedFrom().contains(b.key()) || b.unlinkedFrom().contains(a.key())) continue;
                boolean same = a.home().equals(b.home()) && a.away().equals(b.away());
                double home = similarity(a.home(), b.home()), away = similarity(a.away(), b.away());
                if (!same && Math.min(home, away) < SIMILAR) continue;
                Map<String, Object> pair = new LinkedHashMap<>();
                pair.put("a", a.rep());
                pair.put("b", b.rep());
                pair.put("reason", same ? "SAME_TEAMS" : "SIMILAR_NAMES");
                pair.put("score", same ? 1.0 : Math.round((home + away) * 50) / 100.0);
                pairs.add(pair);
            }
        }
        pairs.sort(Comparator.comparing((Map<String, Object> m) -> -(double) m.get("score"))
            .thenComparing(m -> (Instant) ((Map<?, ?>) m.get("a")).get("startTime"), Comparator.reverseOrder()));
        int fromIdx = Math.min(pairs.size(), pg * sz);
        return Paging.response(pairs.subList(fromIdx, Math.min(pairs.size(), fromIdx + sz)), pg, sz, pairs.size());
    }

    /** pg_trgm-style similarity (shared / all trigrams of the padded words), computed here so no extension is needed. */
    static double similarity(String x, String y) {
        Set<String> a = trigrams(x), b = trigrams(y);
        if (a.isEmpty() || b.isEmpty()) return 0;
        Set<String> shared = new HashSet<>(a);
        shared.retainAll(b);
        return shared.size() / (double) (a.size() + b.size() - shared.size());
    }

    private static Set<String> trigrams(String s) {
        Set<String> out = new HashSet<>();
        for (String w : s.split(" ")) {
            if (w.isEmpty()) continue;
            String padded = "  " + w + " ";
            for (int i = 0; i + 3 <= padded.length(); i++) out.add(padded.substring(i, i + 3));
        }
        return out;
    }
}
