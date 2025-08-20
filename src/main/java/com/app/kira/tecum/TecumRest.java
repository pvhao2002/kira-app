package com.app.kira.tecum;

import com.app.kira.util.JsonUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.http.*;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.sql.Date;
import java.util.List;
import java.util.Map;
import java.util.logging.Level;
import java.util.stream.Collectors;

@Log
@RestController
@RequestMapping("tecum")
@RequiredArgsConstructor
public class TecumRest {
    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final RestTemplate restTemplate;
    private static final String SQL_GET_TECUM_ACCOUNT = """
            select ta.tecum_account_id
                 , ta.tecum_name
                 , ta.balance
                 , ta.balance_holding
                 , ta.balance_left_dividend
                 , ta.bonus
                 , CONVERT_TZ(ta.updated_at, '+00:00', '+07:00') as updated_at
                 , ta.note
                 , tat.attendance_date
                 , tat.status
                 , CONVERT_TZ(tat.created_at, '+00:00', '+07:00') as created_at
            from tecum_account ta
                     left join tecum_attendance tat on tat.tecum_account_id = ta.tecum_account_id
            """;
    private static final String SQL_INSERT_TECUM_ACCOUNT = """
            INSERT INTO tecum_account(tecum_name, tecum_username, tecum_password)
            VALUES (:tecum_name, :tecum_username, :tecum_password)
            ON DUPLICATE KEY UPDATE tecum_username = IFNULL(VALUES(tecum_username), tecum_account.tecum_username),
                                     tecum_password = IFNULL(VALUES(tecum_password), tecum_account.tecum_password)
            """;

    @GetMapping
    public Object findAll() {
        return jdbcTemplate.query(SQL_GET_TECUM_ACCOUNT, BeanPropertyRowMapper.newInstance(TecumDTO.class))
                .stream()
                .collect(Collectors.groupingBy(TecumDTO::getTecumAccountId))
                .entrySet()
                .stream()
                .map(TecumDTO::new)
                .toList();
    }

    @GetMapping("/popup/{accountId}")
    public Object openPopup(@PathVariable Long accountId) {
        var cookie = jdbcTemplate.queryForObject("""
                    select tecum_cookie from tecum_account where tecum_account_id = :accountId
                """, Map.of("accountId", accountId), (rs, i) -> rs.getString("tecum_cookie"));
        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.COOKIE, cookie);

        HttpEntity<Void> entity = new HttpEntity<>(headers);
        ResponseEntity<String> response = restTemplate.exchange(
                "https://tecumfund.com/account",
                HttpMethod.GET,
                entity,
                String.class
        );
        return response.getBody();
    }


    @PostMapping
    public Object createOrUpdate(@RequestBody TecumPayload payload) {
        jdbcTemplate.update(SQL_INSERT_TECUM_ACCOUNT, payload.toMapSqlParameterSource());
        return Map.of(
                "accountName", payload.getAccountName(),
                "message", "Account created successfully"
        );
    }

    @GetMapping("auto")
    public Object takeCookie() {
        autoAttendance();
        return Map.of("message", "Auto attendance initiated");
    }

    @Scheduled(cron = "0 0 4 * * *", zone = "Asia/Ho_Chi_Minh")
    public void autoAttendance() {
        // Lấy danh sách tài khoản có cookie
        getCookie();
        var result = jdbcTemplate.query("""
                select *
                from tecum_account
                where tecum_cookie is not null
                """, BeanPropertyRowMapper.newInstance(TecumDTO.class));
        // Lặp qua từng tài khoản và gọi API
        result.forEach(e -> {
            try {
                callApiTecum(e, "https://tecumfund.com/rpc/app/reward/checkin/check", "{}", "check");
                Thread.sleep(2_000);
                callApiTecum(e, "https://tecumfund.com/rpc/app/reward/checkin/draw", "{}", "draw");
                Thread.sleep(2_000);
                callApiTecum(e, "https://tecumfund.com/rpc/app/reward/checkin/get", "{}", "balance");
                Thread.sleep(2_000);
                callApiTecum(e, "https://tecumfund.com/rpc/app/user/holdingOrder", "{}", "balance");
                log.info("Auto attendance completed for account: " + e.getTecumName());
                 // Delay 10 giây giữa các lần gọi API
            } catch (InterruptedException ex) {
                throw new RuntimeException(ex);
            }
        });
    }

    private void callApiTecum(TecumDTO item, String url, String body, String type) {
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.COOKIE, item.getTecumCookie());
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> entity = new HttpEntity<>(body, headers);
        try {
            ResponseEntity<TecumRespone> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    TecumRespone.class
            );
            if (response.getStatusCode() == HttpStatus.OK) {
                log.info("API call successful for account: " + item.getTecumName());
                if ("draw".equalsIgnoreCase(type)) {
                    jdbcTemplate.update("""
                            update tecum_attendance
                            set status = 'PRESENT'
                            where tecum_account_id = :tecum_account_id
                              and attendance_date = :date
                            """, Map.of("tecum_account_id", item.getTecumAccountId(), "date", new Date(System.currentTimeMillis())));
                } else if ("balance".equalsIgnoreCase(type)) {
                    var responseBody = response.getBody();
                    if (responseBody != null) {
                        var balance = JsonUtil.fromJson(JsonUtil.toJson(responseBody.getJson()), TecumRespone.TecumBalance.class);
                        jdbcTemplate.update("""
                                update tecum_account
                                 set balance               = IFNULL(:balance, balance),
                                     balance_holding       = IFNULL(:balance_holding, balance_holding),
                                     balance_left_dividend = IFNULL(:balance_left_dividend, balance_left_dividend),
                                     bonus                 = IFNULL(:bonus, bonus)
                                 where tecum_account_id = :tecum_account_id
                                """, new MapSqlParameterSource("tecum_account_id", item.getTecumAccountId())
                                .addValue("balance", balance.getBalance())
                                .addValue("balance_holding", balance.getAmount())
                                .addValue("balance_left_dividend", balance.getLeftDividend())
                                .addValue("bonus", balance.getBonus()));
                    }
                }
            }
        } catch (HttpClientErrorException ex) {
            log.log(Level.SEVERE, "Error calling API for account: " + item.getTecumName(), ex);
        }
    }


    public void getCookie() {
        // take cookie from tecum and update
        var result = jdbcTemplate.query("""
                select *
                from tecum_account
                where tecum_cookie is null
                """, BeanPropertyRowMapper.newInstance(TecumDTO.class));
        result.forEach(e -> {
            var body = """
                    {
                      "json": {
                        "type": "phone.password",
                        "phone": "+84 %s",
                        "password": "%s"
                      }
                    }
                    """.formatted(e.getTecumUsername(), e.getTecumPassword());
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<String> entity = new HttpEntity<>(body, headers);
            try {
                ResponseEntity<String> response = restTemplate.exchange(
                        "https://tecumfund.com/rpc/app/auth/login",
                        HttpMethod.POST,
                        entity,
                        String.class
                );

                List<String> cookies = response.getHeaders().get(HttpHeaders.SET_COOKIE);
                if (cookies != null && !cookies.isEmpty()) {
                    String joinedCookies = cookies.stream()
                            .map(c -> c.split(";", 2)[0])
                            .collect(Collectors.joining("; "));
                    jdbcTemplate.update("""
                                update tecum_account
                                set tecum_cookie = :cookie,
                                    note         = NULL
                                where tecum_account_id = :tecum_account_id
                            """, Map.of("cookie", joinedCookies, "tecum_account_id", e.getTecumAccountId()));
                } else {
                    jdbcTemplate.update("""
                            update tecum_account
                            set note = 'No cookies found in response'
                            where tecum_account_id = :tecum_account_id
                            """, Map.of("tecum_account_id", e.getTecumAccountId()));
                }
            } catch (HttpClientErrorException.BadRequest ex) {
                jdbcTemplate.update("""
                        update tecum_account
                        set note = :note,
                            tecum_cookie = NULL
                        where tecum_account_id = :tecum_account_id
                        """, Map.of("note", ex.getResponseBodyAsString(), "tecum_account_id", e.getTecumAccountId()));
            } catch (Exception ex) {
                log.log(Level.SEVERE, ex.getMessage(), ex);
            }
        });
    }
}
