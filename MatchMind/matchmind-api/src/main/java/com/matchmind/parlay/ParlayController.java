package com.matchmind.parlay;

import com.matchmind.security.Principals.UserPrincipal;
import com.matchmind.shared.ApiException;
import com.matchmind.shared.ApiTypes.PageResponse;
import com.matchmind.shared.Paging;
import com.matchmind.shared.Sql;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;

/**
 * A signed-in user's parlays: picks of different matches combined into one bet. Each user sees and deletes only their
 * own. The result is worked out on read from the legs' current pick results, so it follows recalculations and overrides.
 */
@RestController
@RequestMapping("/api/v1/parlays")
@RequiredArgsConstructor
public class ParlayController {
    private static final BigDecimal TWO = BigDecimal.valueOf(2);
    private static final BigDecimal HALF = new BigDecimal("0.5");

    private final NamedParameterJdbcTemplate db;

    public record Create(@NotNull @Size(min = 2, max = 20) List<@NotNull UUID> pickIds,
                         @Positive @Digits(integer = 14, fraction = 4) BigDecimal stake) {}
    public record Leg(UUID pickId, UUID predictionId, UUID matchId, String homeTeam, String awayTeam, String league,
                      Instant startTime, String market, String pick, BigDecimal line, String lineDisplay, BigDecimal price,
                      String result) {}
    public record Parlay(UUID id, Instant createdAt, BigDecimal stake, List<Leg> legs, BigDecimal totalOdds, String result,
                         BigDecimal payout, BigDecimal profit) {}
    record Priced(BigDecimal price, String result) {}
    record Outcome(BigDecimal totalOdds, String result, BigDecimal payout, BigDecimal profit) {}

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Map<String, UUID> create(@AuthenticationPrincipal UserPrincipal user, @Valid @RequestBody Create body) {
        if (new HashSet<>(body.pickIds()).size() != body.pickIds().size()) {
            throw ApiException.badRequest("DUPLICATE_PICK", "A pick can be in the parlay only once");
        }
        var picks = db.query("""
            SELECT k.id, p.match_id, %s AS price FROM prediction_picks k
            JOIN predictions p ON p.id = k.prediction_id JOIN prediction_odds o ON o.id = k.odds_id
            WHERE k.id IN (:ids)""".formatted(Sql.PRICE.replace("pk.", "k.")),
            Map.of("ids", body.pickIds()), (rs, i) -> new Object[]{rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getBigDecimal(3)});
        if (picks.size() != body.pickIds().size()) throw ApiException.notFound("PICK_NOT_FOUND", "A pick of the parlay does not exist");
        if (picks.stream().map(p -> p[1]).distinct().count() != picks.size()) {
            throw ApiException.badRequest("SAME_MATCH", "A parlay takes one pick per match");
        }
        if (picks.stream().anyMatch(p -> p[2] == null)) throw ApiException.badRequest("NO_PRICE", "A pick of the parlay has no price");
        UUID id = db.queryForObject("INSERT INTO parlays (user_id, stake) VALUES (:user, :stake) RETURNING id",
            new MapSqlParameterSource("user", user.id()).addValue("stake", body.stake()), UUID.class);
        for (Object[] p : picks) {
            db.update("INSERT INTO parlay_legs (parlay_id, pick_id, match_id) VALUES (:parlay, :pick, :match)",
                Map.of("parlay", id, "pick", p[0], "match", p[1]));
        }
        return Map.of("id", id);
    }

    @GetMapping
    @Transactional(readOnly = true)
    public PageResponse<Parlay> list(@AuthenticationPrincipal UserPrincipal user, @RequestParam(required = false) Integer page,
                                     @RequestParam(required = false) Integer size) {
        int pg = Paging.page(page), sz = Paging.size(size);
        var params = new MapSqlParameterSource("user", user.id());
        long total = db.queryForObject("SELECT count(*) FROM parlays WHERE user_id = :user", params, Long.class);
        Paging.limit(params, pg, sz);
        var heads = db.query("SELECT id, created_at, stake FROM parlays WHERE user_id = :user "
            + "ORDER BY created_at DESC, id LIMIT :limit OFFSET :offset", params,
            (rs, i) -> new Object[]{rs.getObject(1, UUID.class), rs.getTimestamp(2).toInstant(), rs.getBigDecimal(3)});
        Map<UUID, List<Leg>> legs = new HashMap<>();
        if (!heads.isEmpty()) {
            db.query("""
                SELECT l.parlay_id, k.id, k.prediction_id, m.id, m.home_team, m.away_team, m.league, m.start_time, k.market,
                       k.pick, o.line, o.line_display, %s AS price, coalesce(r.result, 'PENDING') AS result
                FROM parlay_legs l JOIN prediction_picks k ON k.id = l.pick_id JOIN matches m ON m.id = l.match_id
                JOIN prediction_odds o ON o.id = k.odds_id
                LEFT JOIN prediction_pick_results r ON r.pick_id = k.id AND r.is_current
                WHERE l.parlay_id IN (:ids) ORDER BY m.start_time, m.id""".formatted(Sql.PRICE.replace("pk.", "k.")),
                Map.of("ids", heads.stream().map(h -> h[0]).toList()), rs -> {
                    legs.computeIfAbsent(rs.getObject(1, UUID.class), k -> new ArrayList<>()).add(new Leg(
                        rs.getObject(2, UUID.class), rs.getObject(3, UUID.class), rs.getObject(4, UUID.class), rs.getString(5),
                        rs.getString(6), rs.getString(7), rs.getTimestamp(8).toInstant(), rs.getString(9), rs.getString(10),
                        rs.getBigDecimal(11), rs.getString(12), rs.getBigDecimal(13), rs.getString(14)));
                });
        }
        var data = heads.stream().map(h -> {
            var own = legs.getOrDefault((UUID) h[0], List.of());
            var o = settle(own.stream().map(l -> new Priced(l.price(), l.result())).toList(), (BigDecimal) h[2]);
            return new Parlay((UUID) h[0], (Instant) h[1], (BigDecimal) h[2], own, o.totalOdds(), o.result(), o.payout(), o.profit());
        }).toList();
        return Paging.response(data, pg, sz, total);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal UserPrincipal user, @PathVariable UUID id) {
        int n = db.update("DELETE FROM parlays WHERE id = :id AND user_id = :user", Map.of("id", id, "user", user.id()));
        if (n == 0) throw ApiException.notFound("PARLAY_NOT_FOUND", "No such parlay");
    }

    /**
     * Any LOSS loses the parlay; else any PENDING keeps it open; else each leg multiplies the return: WIN by its price,
     * HALF_WIN by (1 + price) / 2, PUSH and VOID by 1, HALF_LOSS by 0.5. Above 1 is a WIN, exactly 1 a PUSH, below a LOSS.
     */
    static Outcome settle(List<Priced> legs, BigDecimal stake) {
        BigDecimal odds = legs.stream().map(Priced::price).reduce(BigDecimal.ONE, BigDecimal::multiply).setScale(4, RoundingMode.HALF_UP);
        BigDecimal factor;
        if (legs.stream().anyMatch(l -> "LOSS".equals(l.result()))) factor = BigDecimal.ZERO;
        else if (legs.stream().anyMatch(l -> "PENDING".equals(l.result()))) return new Outcome(odds, "PENDING", null, null);
        else factor = legs.stream().map(l -> switch (l.result()) {
            case "WIN" -> l.price();
            case "HALF_WIN" -> l.price().add(BigDecimal.ONE).divide(TWO);
            case "HALF_LOSS" -> HALF;
            default -> BigDecimal.ONE;   // PUSH, VOID
        }).reduce(BigDecimal.ONE, BigDecimal::multiply);
        String result = switch (factor.compareTo(BigDecimal.ONE)) { case 1 -> "WIN"; case 0 -> "PUSH"; default -> "LOSS"; };
        if (stake == null) return new Outcome(odds, result, null, null);
        BigDecimal payout = stake.multiply(factor).setScale(4, RoundingMode.HALF_UP);
        return new Outcome(odds, result, payout, payout.subtract(stake));
    }
}
