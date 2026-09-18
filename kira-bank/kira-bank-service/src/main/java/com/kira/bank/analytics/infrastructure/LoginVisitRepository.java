package com.kira.bank.analytics.infrastructure;

import com.kira.bank.analytics.application.VisitIpResolver.Resolved;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;

import static com.kira.bank.analytics.application.LoginVisitDtos.*;

@Repository
@RequiredArgsConstructor
public class LoginVisitRepository {
    private static final String FILTER = " FROM login_visits WHERE visited_at>=? AND visited_at<? AND (?='' OR ip=?)";
    private final JdbcTemplate jdbc;

    public void insert(VisitWrite v, Resolved ip, String agent, String referrer) {
        jdbc.update("""
            INSERT INTO login_visits(id,ip,peer_ip,ip_source,visitor_id,session_id,navigation,user_agent,language,timezone,screen_width,screen_height,referrer)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE id=login_visits.id
            """, v.id().toString(), ip.ip(), ip.peer(), ip.source(), v.visitorId().toString(), v.sessionId().toString(), v.navigation(), agent, v.language(), v.timezone(), v.screenWidth(), v.screenHeight(), referrer);
    }

    public Totals totals(Instant from, Instant to, String ip) {
        return jdbc.queryForObject("SELECT COUNT(*),COALESCE(SUM(navigation='reload'),0),COUNT(DISTINCT ip),COUNT(DISTINCT visitor_id)" + FILTER,
            (r, n) -> new Totals(r.getLong(1), r.getLong(2), r.getLong(3), r.getLong(4)), Timestamp.from(from), Timestamp.from(to), ip, ip);
    }

    public Page<IpRow> ips(Instant from, Instant to, String ip, int page, int size, long count) {
        var rows = jdbc.query("SELECT ip,COUNT(*),SUM(navigation='reload'),COUNT(DISTINCT visitor_id),COUNT(DISTINCT session_id),MIN(visited_at),MAX(visited_at)" + FILTER + " GROUP BY ip ORDER BY MAX(visited_at) DESC,ip LIMIT ? OFFSET ?",
            (r, n) -> new IpRow(r.getString(1), r.getLong(2), r.getLong(3), r.getLong(4), r.getLong(5), r.getTimestamp(6).toInstant(), r.getTimestamp(7).toInstant()), Timestamp.from(from), Timestamp.from(to), ip, ip, size, (long) page * size);
        return new Page<>(rows, count, page, size);
    }

    public Page<Event> events(Instant from, Instant to, String ip, int page, int size) {
        long count = jdbc.queryForObject("SELECT COUNT(*)" + FILTER, Long.class, Timestamp.from(from), Timestamp.from(to), ip, ip);
        var rows = jdbc.query("SELECT *" + FILTER + " ORDER BY visited_at DESC,id LIMIT ? OFFSET ?",
            (r, n) -> new Event(r.getString("id"), r.getTimestamp("visited_at").toInstant(), r.getString("ip"), r.getString("peer_ip"), r.getString("ip_source"), r.getString("visitor_id"), r.getString("session_id"), r.getString("navigation"), r.getString("user_agent"), r.getString("language"), r.getString("timezone"), r.getInt("screen_width"), r.getInt("screen_height"), r.getString("referrer")), Timestamp.from(from), Timestamp.from(to), ip, ip, size, (long) page * size);
        return new Page<>(rows, count, page, size);
    }

    public void purge(Instant before) {
        jdbc.update("DELETE FROM login_visits WHERE visited_at<? LIMIT 10000", Timestamp.from(before));
    }
}
