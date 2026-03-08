package com.app.kira.rest;

import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;

@RestController
@RequestMapping("sql")
@RequiredArgsConstructor
public class SqlEditorController {
    private final NamedParameterJdbcTemplate jdbcTemplate;
    private static final String ft_score_str = "ft_score_str";
    private static final String ht_score_str = ", ht_score_str ";
    private static final String corner_str = "corner_str";
    private static final String _1 = "[1]";
    private static final String _2 = "[2]";
    private static final String _3 = "[3]";

    private static final String SQL = """
            select  [1]
                    [2]
                    , count(1) as count
            from event_analyst
            where first_hdc = :firstHdc
              and last_hdc = :lastHdc
              and first_ou = :firstOu
              and last_ou = :lastOu
              and (:firstCorner = '' OR first_corner = :firstCorner)
              and (:lastCorner = '' OR last_corner = :lastCorner)
              and (:htStr = '' OR ht_score_str = :htStr)
            group by [3]
            order by count desc
            limit 5
            """;

    @PostMapping("/execute")
    public Object executeSql(@RequestBody RequestSql data) {
        var sql = "";
        if ("FT".equalsIgnoreCase(data.mode())) {
            sql = SQL.replace(_1, ft_score_str + " as ft")
                    .replace(_2, "")
                    .replace(_3, ft_score_str);
        } else if ("HT".equalsIgnoreCase(data.mode())) {
            sql = SQL.replace(_1, ft_score_str + " as ft")
                    .replace(_2, ht_score_str + " as ht")
                    .replace(_3, ft_score_str + ht_score_str);
        } else if ("CORNER".equalsIgnoreCase(data.mode())) {
            sql = SQL.replace(_1, corner_str + " as ft")
                    .replace(_2, "")
                    .replace(_3, corner_str);
        }
        var param = new MapSqlParameterSource("firstHdc", handleOneHdc(data.firstHdc()))
                .addValue("lastHdc", handleOneHdc(data.lastHdc()))
                .addValue("firstOu", data.firstOu())
                .addValue("lastOu", data.lastOu())
                .addValue("firstCorner", Optional.ofNullable(data.firstCorner()).orElse(""))
                .addValue("lastCorner", Optional.ofNullable(data.lastCorner()).orElse(""))
                .addValue("htStr", Optional.ofNullable(data.htScoreStr()).orElse(""));
        return jdbcTemplate.query(sql, param, BeanPropertyRowMapper.newInstance(ResultSql.class));
    }

    private String handleOneHdc(String hdc) {
        return Optional.ofNullable(hdc).map(h -> {
            if("0".equalsIgnoreCase(h)) {
                return "0#0";
            }
            if (h.contains("#")) {
                return h;
            }
            var sign = h.charAt(0) == '-' ? "+" : "-";
            return "%s#%s".formatted(h, sign.concat(h.substring(1)));
        }).orElse("");
    }

    public record RequestSql(
            String firstHdc,
            String lastHdc,
            String firstOu,
            String lastOu,
            String firstCorner,
            String lastCorner,
            String htScoreStr,
            String mode
    ) {
    }


    @Data
    public static class ResultSql {
        private String ft;
        private String ht;
        private Integer count;
    }
}
