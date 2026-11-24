package com.matchmind.visit;

import com.matchmind.shared.ApiException;
import com.matchmind.shared.ApiTypes.PageResponse;
import com.matchmind.shared.ClientIpResolver;
import com.matchmind.shared.Paging;
import com.matchmind.shared.Sql;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Signed-out visitors. The login page sends the public IP it got from api.ipify.org; the country comes from the
 * CF-IPCountry header Cloudflare adds, and browser and OS from the User-Agent. POST is public; reads are ADMIN only
 * ({@code SecurityConfig}). The same IP and browser within 30 minutes is one visit.
 */
@RestController
@RequestMapping("/api/v1/visits")
@RequiredArgsConstructor
@Tag(name = "Visitors")
public class VisitController {
    private final NamedParameterJdbcTemplate jdbc;
    private final ClientIpResolver clientIp;

    @PostMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Record a signed-out visit (public). Body: {\"ip\": \"<public IP from ipify>\"}, ip optional")
    public void record(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        if (!Set.of("ip").containsAll(body.keySet())) throw ApiException.badRequest("MALFORMED_REQUEST", "Only ip is accepted");
        String ip;
        if (body.get("ip") != null) {
            ip = body.get("ip") instanceof String s ? ClientIpResolver.normalize(s) : null;
            if (ip == null) throw ApiException.badRequest("INVALID_IP", "ip must be an IPv4 or IPv6 address");
        } else {
            ip = ClientIpResolver.normalize(request.getHeader("CF-Connecting-IP"));
            if (ip == null) ip = clientIp.resolve(request);
        }
        String country = request.getHeader("CF-IPCountry");
        if (country == null || !country.matches("[A-Z0-9]{2}")) country = "XX";   // Cloudflare's own "unknown" code
        String agent = request.getHeader("User-Agent");
        if (agent != null && agent.length() > 512) agent = agent.substring(0, 512);
        jdbc.update("""
            INSERT INTO visits (ip, country, browser, os, user_agent)
            SELECT :ip, :country, :browser, :os, :agent
            WHERE NOT EXISTS (SELECT 1 FROM visits WHERE ip = :ip AND user_agent IS NOT DISTINCT FROM :agent
                              AND visited_at > now() - interval '30 minutes')
            """, new MapSqlParameterSource().addValue("ip", ip).addValue("country", country)
            .addValue("browser", browser(agent)).addValue("os", os(agent)).addValue("agent", agent));
    }

    @GetMapping("/countries")
    public List<Map<String, Object>> countries() {
        return jdbc.query("""
            SELECT country AS "country", count(*) AS "visits", count(DISTINCT ip) AS "uniqueIps", max(visited_at) AS "lastSeen"
            FROM visits GROUP BY country ORDER BY count(*) DESC, country
            """, Map.of(), Sql.ROW);
    }

    @GetMapping
    public PageResponse<Map<String, Object>> list(@RequestParam(required = false) String country,
                                                  @RequestParam(required = false) Integer page,
                                                  @RequestParam(required = false) Integer size) {
        int pg = Paging.page(page), sz = size == null ? 100 : Paging.size(size);
        Sql.Where w = new Sql.Where().and("country = :country", "country", country);
        long total = jdbc.queryForObject("SELECT count(*) FROM visits" + w.sql(), w.params, Long.class);
        Paging.limit(w.params, pg, sz);
        List<Map<String, Object>> rows = jdbc.query("""
            SELECT id AS "id", visited_at AS "visitedAt", ip AS "ip", country AS "country", browser AS "browser", os AS "os",
                   user_agent AS "userAgent" FROM visits""" + w.sql() + " ORDER BY visited_at DESC, id DESC LIMIT :limit OFFSET :offset",
            w.params, Sql.ROW);
        return Paging.response(rows, pg, sz, total);
    }

    /** Order matters: Edge and Opera also say Chrome, Chrome also says Safari. */
    static String browser(String ua) {
        if (ua == null) return "Other";
        if (ua.contains("Edg/")) return "Edge";
        if (ua.contains("OPR/") || ua.contains("Opera")) return "Opera";
        if (ua.contains("Firefox/")) return "Firefox";
        if (ua.contains("Chrome/") || ua.contains("CriOS/")) return "Chrome";
        if (ua.contains("Safari/")) return "Safari";
        return "Other";
    }

    static String os(String ua) {
        if (ua == null) return "Other";
        if (ua.contains("Windows")) return "Windows";
        if (ua.contains("Android")) return "Android";
        if (ua.contains("iPhone") || ua.contains("iPad")) return "iOS";
        if (ua.contains("Mac OS X")) return "macOS";
        if (ua.contains("Linux")) return "Linux";
        return "Other";
    }
}
