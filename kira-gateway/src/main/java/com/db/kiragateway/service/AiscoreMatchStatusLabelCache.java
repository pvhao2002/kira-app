package com.db.kiragateway.service;

import jakarta.annotation.PostConstruct;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.HashMap;
import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;

@Service
public class AiscoreMatchStatusLabelCache {

    private static final Logger log = Logger.getLogger(AiscoreMatchStatusLabelCache.class.getName());
    private static final int FOOTBALL_SPORT_ID = 1;

    private static final String SQL_LOAD_LABELS = """
            select code, label
            from aiscore_match_status_ref
            where status_type = 'status_id'
              and sport_id = :sport_id
            """;

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private Map<Integer, String> labelsByStatusId = Map.of();

    public AiscoreMatchStatusLabelCache(NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    void load() {
        var loaded = new HashMap<Integer, String>();
        jdbcTemplate.query(
                SQL_LOAD_LABELS,
                Map.of("sport_id", FOOTBALL_SPORT_ID),
                (rs, rn) -> loaded.put(rs.getInt("code"), rs.getString("label"))
        );
        labelsByStatusId = Map.copyOf(loaded);
        if (labelsByStatusId.isEmpty()) {
            log.log(Level.WARNING, "aiscore_match_status_ref cache is empty for status_id sport_id=1");
        } else {
            log.info("Loaded %d aiscore_match_status_ref labels (status_id, sport_id=1)"
                    .formatted(labelsByStatusId.size()));
        }
    }

    public String resolveStatus(Integer statusId, String apiStatusFallback) {
        if (statusId == null) {
            return defaultStatus(apiStatusFallback);
        }
        String label = labelsByStatusId.get(statusId);
        if (label != null) {
            return StringUtils.hasText(label) ? label : "-";
        }
        return defaultStatus(apiStatusFallback);
    }

    private static String defaultStatus(String status) {
        return StringUtils.hasText(status) ? status : "-";
    }
}
