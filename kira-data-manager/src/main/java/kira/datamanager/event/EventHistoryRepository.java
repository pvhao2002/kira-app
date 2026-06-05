package kira.datamanager.event;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Repository
public class EventHistoryRepository {

    private final JdbcClient jdbcClient;

    public EventHistoryRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public EventHistoryPageResponse findPage(String date, String q, String league, int page, int size) {
        var where = buildWhereClause(date, q, league);
        var filterFrom = buildFilterFrom(where);

        var countSql = "SELECT COUNT(*) " + filterFrom + " WHERE 1=1" + where.clause();

        var countSpec = bindParams(jdbcClient.sql(countSql), where);
        var total = countSpec.query((rs, rowNum) -> rs.getLong(1)).single();

        // Query list of event IDs first (paginated), then fetch full data for those IDs.
        var idSql = "SELECT e.event_id " + filterFrom + " WHERE 1=1" + where.clause()
                + " ORDER BY e.event_date ASC LIMIT :limit OFFSET :offset";

        var idSpec = bindParams(jdbcClient.sql(idSql), where)
                .param("limit", size)
                .param("offset", page * size);
        var ids = idSpec.query((rs, rowNum) -> rs.getLong(1)).list();

        List<EventHistoryRowResponse> content;
        if (ids.isEmpty()) {
            content = List.of();
        } else {
            // Fetch event base data + result for those IDs
            var eventSql = """
                    SELECT e.event_id,
                           e.event_name,
                           e.event_date,
                           e.status,
                           l.league_name,
                           l.logo_url AS league_logo_url,
                           ht.team_name AS home_team,
                           ht.logo_url AS home_logo_url,
                           at2.team_name AS away_team,
                           at2.logo_url AS away_logo_url,
                           er.ft_goal_str,
                           er.ft_home_corner,
                           er.ft_away_corner,
                           er.ft_home_yellow_card,
                           er.ft_away_yellow_card,
                           e.link
                    FROM events e
                    LEFT JOIN leagues l ON l.league_id = e.league_id
                    LEFT JOIN teams ht ON ht.team_id = e.home_id
                    LEFT JOIN teams at2 ON at2.team_id = e.away_id
                    LEFT JOIN event_result er ON er.event_id = e.event_id
                    WHERE e.event_id IN (:ids)
                    ORDER BY e.event_date ASC
                    """;
            var eventRows = jdbcClient.sql(eventSql)
                    .param("ids", ids)
                    .query(this::mapEventRow)
                    .list();

            var oddsSql = """
                    SELECT event_id, type, market, line, price_a, price_b
                    FROM event_odds
                    WHERE event_id IN (:ids) AND type IN ('open', 'pre-match', 'half-time')
                    """;
            var oddsRows = jdbcClient.sql(oddsSql)
                    .param("ids", ids)
                    .query(this::mapOddsRow)
                    .list();

            var oddsMap = buildOddsMap(oddsRows);

            content = eventRows.stream()
                    .map(row -> assembleRow(row, oddsMap.getOrDefault(row.eventId(), Map.of())))
                    .toList();
        }

        var totalPages = size > 0 ? (int) Math.ceil((double) total / size) : 0;
        if (total == 0) {
            totalPages = 0;
        }

        return new EventHistoryPageResponse(content, page, size, total, totalPages);
    }

    public List<EventOddsTimelineEntry> findOddsTimeline(long eventId) {
        var sql = """
                SELECT market, line, price_a, price_b, match_minute, crawled_at
                FROM event_odds_timeline
                WHERE event_id = :event_id
                ORDER BY market, crawled_at ASC
                """;
        return jdbcClient.sql(sql)
                .param("event_id", eventId)
                .query(this::mapTimelineRow)
                .list();
    }

    // -------- helpers --------

    private record EventBaseRow(
            long eventId, String eventName, LocalDateTime eventDate, String status,
            String leagueName, String leagueLogoUrl,
            String homeTeam, String homeLogoUrl,
            String awayTeam, String awayLogoUrl,
            String ftGoalStr,
            Integer ftHomeCorner, Integer ftAwayCorner,
            Integer ftHomeYellowCard, Integer ftAwayYellowCard,
            String link
    ) {}

    private record OddsRow(long eventId, String type, String market, String line, BigDecimal priceA, BigDecimal priceB) {}

    private EventBaseRow mapEventRow(ResultSet rs, int rowNum) throws SQLException {
        var ts = rs.getTimestamp("event_date");
        return new EventBaseRow(
                rs.getLong("event_id"),
                rs.getString("event_name"),
                ts != null ? ts.toLocalDateTime() : null,
                rs.getString("status"),
                rs.getString("league_name"),
                rs.getString("league_logo_url"),
                rs.getString("home_team"),
                rs.getString("home_logo_url"),
                rs.getString("away_team"),
                rs.getString("away_logo_url"),
                rs.getString("ft_goal_str"),
                rs.getObject("ft_home_corner", Integer.class),
                rs.getObject("ft_away_corner", Integer.class),
                rs.getObject("ft_home_yellow_card", Integer.class),
                rs.getObject("ft_away_yellow_card", Integer.class),
                rs.getString("link")
        );
    }

    private OddsRow mapOddsRow(ResultSet rs, int rowNum) throws SQLException {
        return new OddsRow(
                rs.getLong("event_id"),
                rs.getString("type"),
                rs.getString("market"),
                rs.getString("line"),
                rs.getBigDecimal("price_a"),
                rs.getBigDecimal("price_b")
        );
    }

    private EventOddsTimelineEntry mapTimelineRow(ResultSet rs, int rowNum) throws SQLException {
        var ts = rs.getTimestamp("crawled_at");
        return new EventOddsTimelineEntry(
                rs.getString("market"),
                rs.getString("line"),
                rs.getBigDecimal("price_a"),
                rs.getBigDecimal("price_b"),
                rs.getString("match_minute"),
                ts != null ? ts.toLocalDateTime() : null
        );
    }

    /**
     * Build a nested map: eventId -> market -> oddsType("open"/"pre"/"ht") -> OddsInfo
     */
    private Map<Long, Map<String, Map<String, EventHistoryOddsInfo>>> buildOddsMap(List<OddsRow> oddsRows) {
        Map<Long, Map<String, Map<String, EventHistoryOddsInfo>>> result = new HashMap<>();

        for (var row : oddsRows) {
            var byMarket = result.computeIfAbsent(row.eventId(), k -> new HashMap<>());
            var byType = byMarket.computeIfAbsent(row.market(), k -> new HashMap<>());
            var typeKey = oddsTypeKey(row.type());
            byType.putIfAbsent(typeKey, new EventHistoryOddsInfo(row.line(), row.priceA(), row.priceB()));
        }

        return result;
    }

    private static String oddsTypeKey(String type) {
        if (type == null) {
            return "";
        }
        return switch (type) {
            case "pre-match" -> "pre";
            case "half-time" -> "ht";
            default -> type;
        };
    }

    private EventHistoryRowResponse assembleRow(
            EventBaseRow base,
            Map<String, Map<String, EventHistoryOddsInfo>> oddsForEvent) {

        var hdcSection = buildSection(oddsForEvent.get("hdc"));
        var ouSection = buildSection(oddsForEvent.get("ou"));
        var cornerSection = buildSection(oddsForEvent.get("corner"));

        EventHistoryOdds odds = null;
        if (hdcSection != null || ouSection != null || cornerSection != null) {
            odds = new EventHistoryOdds(hdcSection, ouSection, cornerSection);
        }

        return new EventHistoryRowResponse(
                base.eventId(),
                base.eventName(),
                base.eventDate(),
                base.status(),
                base.leagueName(),
                base.leagueLogoUrl(),
                base.homeTeam(),
                base.homeLogoUrl(),
                base.awayTeam(),
                base.awayLogoUrl(),
                base.ftGoalStr(),
                base.ftHomeCorner(),
                base.ftAwayCorner(),
                base.ftHomeYellowCard(),
                base.ftAwayYellowCard(),
                odds,
                base.link()
        );
    }

    private EventHistoryOddsSection buildSection(Map<String, EventHistoryOddsInfo> byType) {
        if (byType == null || byType.isEmpty()) {
            return null;
        }
        return new EventHistoryOddsSection(
                byType.get("open"),
                byType.get("pre"),
                byType.get("ht")
        );
    }

    // -------- where-clause builder --------

    private record WhereClause(
            String clause,
            LocalDateTime dateStart,
            LocalDateTime dateEnd,
            String q,
            String league,
            boolean needsLeagueJoin,
            boolean needsTeamJoins
    ) {}

    private static String buildFilterFrom(WhereClause w) {
        var from = new StringBuilder("FROM events e");
        if (w.needsLeagueJoin()) {
            from.append(" LEFT JOIN leagues l ON l.league_id = e.league_id");
        }
        if (w.needsTeamJoins()) {
            from.append(" LEFT JOIN teams ht ON ht.team_id = e.home_id");
            from.append(" LEFT JOIN teams at2 ON at2.team_id = e.away_id");
        }
        return from.toString();
    }

    private WhereClause buildWhereClause(String date, String q, String league) {
        var clause = new StringBuilder();
        LocalDateTime dateStart = null;
        LocalDateTime dateEnd = null;
        String normalizedQ = null;
        String normalizedLeague = null;

        if (date != null && !date.isBlank()) {
            var day = LocalDate.parse(date.trim());
            dateStart = day.atStartOfDay();
            dateEnd = day.plusDays(1).atStartOfDay();
            clause.append(" AND e.event_date >= :dateStart AND e.event_date < :dateEnd");
        }
        if (q != null && !q.isBlank()) {
            normalizedQ = q.trim();
            clause.append(" AND (e.event_name LIKE :q OR ht.team_name LIKE :q OR at2.team_name LIKE :q)");
        }
        if (league != null && !league.isBlank()) {
            normalizedLeague = league.trim();
            clause.append(" AND l.league_name LIKE :league");
        }

        return new WhereClause(
                clause.toString(),
                dateStart,
                dateEnd,
                normalizedQ,
                normalizedLeague,
                normalizedLeague != null,
                normalizedQ != null
        );
    }

    private JdbcClient.StatementSpec bindParams(JdbcClient.StatementSpec spec, WhereClause w) {
        if (w.dateStart() != null) {
            spec = spec.param("dateStart", w.dateStart()).param("dateEnd", w.dateEnd());
        }
        if (w.q() != null) {
            spec = spec.param("q", "%" + w.q() + "%");
        }
        if (w.league() != null) {
            spec = spec.param("league", "%" + w.league() + "%");
        }
        return spec;
    }
}
