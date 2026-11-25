package com.matchmind.security;

import com.matchmind.security.Principals.UserPrincipal;
import com.matchmind.shared.ApiTypes.PageResponse;
import com.matchmind.shared.ClientIpResolver;
import com.matchmind.shared.Paging;
import com.matchmind.shared.Sql;
import com.matchmind.visit.VisitController;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Account activity: each sign-in attempt and each change (POST, PUT, PATCH, DELETE) a signed-in user makes, with its
 * outcome, IP and browser. Reads are not recorded, nor token refreshes. Never stores bodies, query strings or tokens.
 */
@Component
@RequiredArgsConstructor
public class UserActivity extends OncePerRequestFilter {
    /** The login endpoint sets the typed username here; the row keeps it only when it names a real user. */
    static final String ATTEMPTED_USERNAME = UserActivity.class.getName() + ".username";
    private static final String LOGIN = "/api/v1/auth/login";
    private static final Logger log = LoggerFactory.getLogger(UserActivity.class);
    private final NamedParameterJdbcTemplate jdbc;
    private final ClientIpResolver ips;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest r) {
        String m = r.getMethod(), path = r.getRequestURI();
        return "GET".equals(m) || "HEAD".equals(m) || "OPTIONS".equals(m) || !path.startsWith("/api/v1/")
            || path.equals("/api/v1/auth/refresh") || path.startsWith("/api/v1/external/") || path.startsWith("/api/v1/visits");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
        throws ServletException, IOException {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        UserPrincipal me = auth != null && auth.getPrincipal() instanceof UserPrincipal p ? p : null;
        try {
            chain.doFilter(req, res);
        } finally {
            if (me != null || LOGIN.equals(req.getRequestURI())) record(req, res.getStatus(), me);
        }
    }

    private void record(HttpServletRequest req, int status, UserPrincipal me) {
        Object attempted = req.getAttribute(ATTEMPTED_USERNAME);
        if (me == null && attempted == null) return;   // a login body that failed validation: nobody to name
        String agent = req.getHeader("User-Agent");
        var params = new MapSqlParameterSource("method", req.getMethod())
            .addValue("path", truncate(req.getRequestURI(), 255)).addValue("status", status)
            .addValue("ip", ips.resolve(req)).addValue("agent", truncate(agent, 512));
        try {
            if (me != null) {
                jdbc.update("""
                    INSERT INTO user_activity (user_id, username, method, path, http_status, client_ip, user_agent)
                    VALUES (:userId, :username, :method, :path, :status, :ip, :agent)""",
                    params.addValue("userId", me.id()).addValue("username", me.username()));
            } else {
                jdbc.update("""
                    INSERT INTO user_activity (user_id, username, method, path, http_status, client_ip, user_agent)
                    SELECT u.id, u.username, :method, :path, :status, :ip, :agent
                    FROM (SELECT 1) one LEFT JOIN users u ON lower(u.username) = lower(:attempt)""",
                    params.addValue("attempt", attempted.toString().trim()));
            }
        } catch (RuntimeException e) {   // the request already happened; a lost activity row must not fail it
            log.warn("Activity not recorded: {}", e.getClass().getSimpleName());
        }
    }

    /** Newest first. Admins see everyone (or one user by {@code username}); everyone else only themselves. */
    public PageResponse<Map<String, Object>> list(UserPrincipal me, String username, Integer page, Integer size) {
        int pg = Paging.page(page), sz = Paging.size(size);
        Sql.Where w = new Sql.Where();
        if (!"ADMIN".equals(me.role())) w.and("user_id = :me", "me", me.id());
        else if (username != null && !username.isBlank()) w.and("lower(username) = lower(:username)", "username", username.trim());
        long total = jdbc.queryForObject("SELECT count(*) FROM user_activity" + w.sql(), w.params, Long.class);
        Paging.limit(w.params, pg, sz);
        List<Map<String, Object>> rows = jdbc.query("""
            SELECT id AS "id", at AS "at", username AS "username", method AS "method", path AS "path",
                   http_status AS "status", client_ip AS "clientIp", user_agent AS "userAgent"
            FROM user_activity""" + w.sql() + " ORDER BY at DESC, id LIMIT :limit OFFSET :offset", w.params, Sql.ROW);
        rows.forEach(r -> {
            String ua = (String) r.get("userAgent");
            r.put("browser", VisitController.browser(ua));
            r.put("os", VisitController.os(ua));
        });
        return Paging.response(rows, pg, sz, total);
    }

    private static String truncate(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }
}
