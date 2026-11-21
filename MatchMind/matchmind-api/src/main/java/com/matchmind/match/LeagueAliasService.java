package com.matchmind.match;

import com.matchmind.shared.AdminActions;
import com.matchmind.shared.AdminActions.Kind;
import com.matchmind.shared.ApiException;
import com.matchmind.shared.CacheConfig;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * League aliases (UX-086, V28): an admin maps a variant league name to a canonical one. Filters, the league dropdown and
 * the "by league" report resolve names through the SQL function {@code mm_league}. No chains: an alias is never a
 * canonical name. Every change is logged in admin_actions and evicts the league dropdown cache.
 */
@Service
@RequiredArgsConstructor
public class LeagueAliasService {
    private final NamedParameterJdbcTemplate jdbc;
    private final AdminActions admin;

    public record AliasRequest(@NotBlank @Size(max = 160) String alias, @NotBlank @Size(max = 160) String canonical,
                               @NotBlank @Size(max = 500) String reason) {
    }

    public record AliasView(UUID id, String alias, String canonical, Instant createdAt) {
    }

    private static final String SELECT = "SELECT id, alias, canonical, created_at FROM league_aliases";

    @Transactional(readOnly = true)
    public List<AliasView> list() {
        return jdbc.query(SELECT + " ORDER BY mm_fold(canonical), mm_fold(alias)", Map.of(), (rs, i) -> new AliasView(
            rs.getObject("id", UUID.class), rs.getString("alias"), rs.getString("canonical"),
            rs.getTimestamp("created_at").toInstant()));
    }

    @CacheEvict(value = CacheConfig.LEAGUES, allEntries = true)
    @Transactional
    public AliasView add(AliasRequest r, UUID actor) {
        String alias = r.alias().strip(), canonical = r.canonical().strip();
        MapSqlParameterSource p = new MapSqlParameterSource("alias", alias).addValue("canonical", canonical).addValue("actor", actor);
        if (Boolean.TRUE.equals(jdbc.queryForObject("SELECT mm_fold(:alias) = mm_fold(:canonical)", p, Boolean.class))) {
            throw ApiException.badRequest("LEAGUE_ALIAS_SELF", "A league cannot be an alias of itself");
        }
        // Serialises alias writes so the no-chain check (also a V28 trigger) sees every committed alias.
        jdbc.getJdbcTemplate().execute("LOCK TABLE league_aliases IN SHARE ROW EXCLUSIVE MODE");
        Long clash = jdbc.queryForObject("""
            SELECT count(*) FROM league_aliases
            WHERE mm_fold(btrim(alias)) IN (mm_fold(:alias), mm_fold(:canonical)) OR mm_fold(btrim(canonical)) = mm_fold(:alias)
            """, p, Long.class);
        if (clash != null && clash > 0) {
            throw ApiException.conflict("LEAGUE_ALIAS_CONFLICT",
                "This name is already an alias, or the alias is used as a canonical name; remove that alias first");
        }
        AliasView v = jdbc.queryForObject("INSERT INTO league_aliases (alias, canonical, created_by) VALUES (:alias, :canonical, :actor)"
            + " RETURNING id, alias, canonical, created_at", p, (rs, i) -> new AliasView(rs.getObject("id", UUID.class),
            rs.getString("alias"), rs.getString("canonical"), rs.getTimestamp("created_at").toInstant()));
        admin.record(Kind.LEAGUE_ALIAS, v.id(), "MERGE", r.reason(), actor, Map.of("alias", alias, "canonical", canonical));
        return v;
    }

    @CacheEvict(value = CacheConfig.LEAGUES, allEntries = true)
    @Transactional
    public void remove(UUID id, String reason, UUID actor) {
        List<Map<String, Object>> row = jdbc.queryForList("DELETE FROM league_aliases WHERE id = :id RETURNING alias, canonical",
            new MapSqlParameterSource("id", id));
        if (row.isEmpty()) throw Kind.LEAGUE_ALIAS.notFound();
        admin.record(Kind.LEAGUE_ALIAS, id, "UNMERGE", reason, actor, row.getFirst());
    }
}
