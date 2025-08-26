package com.app.kira.tecum;

import com.app.kira.util.JsonUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.http.*;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.util.CollectionUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
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
                 , ta.commission
                 , ta.withdrawal
                 , ta.deposit
                 , ta.profit
                 , ta.balance_left_dividend
                 , ABS(ta.withdrawal) - ta.deposit as diff
                 , CONVERT_TZ(ta.updated_at, '+00:00', '+07:00') as updated_at
                 , ta.note
            from tecum_account ta
            """;
    private static final String SQL_INSERT_TECUM_ACCOUNT = """
            INSERT INTO tecum_account(tecum_name, tecum_username, tecum_password)
            VALUES (:tecum_name, :tecum_username, :tecum_password)
            ON DUPLICATE KEY UPDATE tecum_username = IFNULL(VALUES(tecum_username), tecum_account.tecum_username),
                                     tecum_password = IFNULL(VALUES(tecum_password), tecum_account.tecum_password)
            """;
    private static final String SQL_INSERT_TECUM_TRANSACTION = """
            insert into tecum_transaction(tecum_account_id, amount, balance, transaction_date, type, note)
            values (:accountId, :amount, :balance, :createdAt, :type, :note)
            """;
    private static final String SQL_DELETE_TECUM_TRANSACTION = """
            delete from tecum_transaction where tecum_account_id = :accountId
            """;

    @GetMapping("tracking")
    public Object tracking(@RequestParam("from") String from, @RequestParam("to") String to) {
        return jdbcTemplate.query("""
                          select t1.*
                              , t1.withdrawal - t1.deposit as diff
                         from (select ta.tecum_account_id
                                    , ta.tecum_name
                                    , ta.balance
                                    , SUM(IF(tt.type = 'WITHDRAW', ABS(tt.amount), 0)) as withdrawal
                                    , SUM(IF(tt.type = 'DEPOSIT', tt.amount, 0))       as deposit
                               from tecum_account ta
                                        left join tecum_transaction tt on tt.tecum_account_id = ta.tecum_account_id
                               where true
                                 and (
                                   FALSE
                                       OR tt.transaction_date is null
                                       OR (tt.type IN ('WITHDRAW', 'DEPOSIT') and date(tt.transaction_date) between :from and :to)
                                   )
                               group by ta.tecum_account_id) as t1
                        """, new MapSqlParameterSource("from", from).addValue("to", to),
                BeanPropertyRowMapper.newInstance(TecumDTO.class));
    }

    @GetMapping("account")
    public Object getAccount() {
        return jdbcTemplate.query("""
                select tecum_name
                     , tecum_username
                     , tecum_password
                from tecum_account
                """, BeanPropertyRowMapper.newInstance(TecumAccountDTO.class));
    }

    @GetMapping
    public Object findAll() {
        var result = new ArrayList<>(jdbcTemplate.query(SQL_GET_TECUM_ACCOUNT, BeanPropertyRowMapper.newInstance(TecumDTO.class))
                .stream()
                .sorted(Comparator.comparing(TecumDTO::getProfit, Comparator.reverseOrder())
                        .thenComparing(TecumDTO::getCommission, Comparator.reverseOrder())
                        .thenComparing(TecumDTO::getBalance, Comparator.reverseOrder()))
                .toList());
        // add row total
        var total = new TecumDTO(result);
        result.add(total);
        return result;
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

    @GetMapping("transactions/{accountId}")
    public Object getTransactions(@PathVariable Long accountId) {
        var result = jdbcTemplate.query("""
                select transaction_date
                     , amount
                     , type
                     , note
                     , updated_at
                from tecum_transaction
                where tecum_account_id = :account_id
                """, Map.of("account_id", accountId), BeanPropertyRowMapper.newInstance(TecumDTO.Transaction.class));
        var types = result.stream()
                .map(TecumDTO.Transaction::getType)
                .distinct()
                .toList();

        return Map.of("data", result, "type", types);
    }

    @GetMapping("auto-transaction")
    public Object autoTransaction() {
        getCookie();
        var result = jdbcTemplate.query("""
                select *
                from tecum_account
                """, BeanPropertyRowMapper.newInstance(TecumDTO.class));
        var body = new CashFlowDTO();
        result.forEach(item -> {
            jdbcTemplate.update(SQL_DELETE_TECUM_TRANSACTION, new MapSqlParameterSource("accountId", item.getTecumAccountId()));
            AtomicBoolean hasNext = new AtomicBoolean(true);
            var first = true;
            while (hasNext.get()) {
                try {
                    HttpHeaders headers = new HttpHeaders();
                    headers.set(HttpHeaders.COOKIE, item.getTecumCookie());
                    headers.setContentType(MediaType.APPLICATION_JSON);
                    var bodyStr = first
                            ? """
                            {
                                "json": {
                                    "filters": {},
                                    "direction": "NEXT",
                                    "cursor": null
                                }
                            }
                            """
                            : JsonUtil.toJson(body);
                    HttpEntity<String> entity = new HttpEntity<>(bodyStr, headers);
                    ResponseEntity<TecumRespone> response = restTemplate.exchange(
                            "https://tecumfund.com/rpc/app/billing/list",
                            HttpMethod.POST,
                            entity,
                            TecumRespone.class
                    );
                    first = false;
                    if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null && response.getBody().getJson() != null) {
                        var responseBody = response.getBody();
                        var rs = JsonUtil.fromJson(JsonUtil.toJson(responseBody.getJson()), TecumRespone.TecumBalance.class);
                        Optional.ofNullable(rs)
                                .ifPresentOrElse(val -> {
                                    log.log(Level.INFO, "Processing account: {0}, hasNext: {1}", new Object[]{item.getTecumName(), rs.getHasNext()});
                                    body.getJson().setCursor(val.getNextCursor());
                                    hasNext.set(val.getHasNext());
                                    if (!CollectionUtils.isEmpty(val.getData())) {
                                        var params = val.getData().stream()
                                                .map(p -> p.toParamTransaction(item.getTecumAccountId()))
                                                .toArray(MapSqlParameterSource[]::new);

                                        jdbcTemplate.batchUpdate(SQL_INSERT_TECUM_TRANSACTION, params);
                                    } else {
                                        hasNext.set(false);
                                    }
                                }, () -> {
                                    hasNext.set(false);
                                    log.info("No data found for account: " + item.getTecumName());
                                });
                    } else {
                        hasNext.set(false);
                    }
                    Thread.sleep(2_000);
                } catch (Exception ex) {
                    log.log(Level.SEVERE, "Error preparing request for account: " + item.getTecumName() + ", body: " + JsonUtil.toJson(body), ex);
                    hasNext.set(false);
                }
            }
        });

        jdbcTemplate.update("""
                UPDATE tecum_account ta
                    JOIN (SELECT tecum_account_id,
                                 SUM(IF(type = 'WITHDRAW', amount, 0)) AS total_withdrawal,
                                 SUM(IF(type = 'DEPOSIT', amount, 0))    AS total_deposit
                          FROM tecum_transaction
                          GROUP BY tecum_account_id) t ON ta.tecum_account_id = t.tecum_account_id
                SET ta.withdrawal = t.total_withdrawal,
                    ta.deposit    = t.total_deposit
                WHERE TRUE
                """, Map.of());

        jdbcTemplate.update("""
                UPDATE tecum_account
                SET profit = ABS(withdrawal) + balance - deposit
                WHERE TRUE
                """, Map.of());
        return Map.of("message", "Cash flow started");
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
                Thread.sleep(2_000);
                callApiTecum(e, "https://tecumfund.com/rpc/app/reward/share", "{}", "reward");
                Thread.sleep(2_000);
                log.info("Auto attendance completed for account: " + e.getTecumName());
            } catch (InterruptedException ex) {
                throw new RuntimeException(ex);
            }
        });

        autoTransaction();
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
                var responseBody = response.getBody();
                log.info("API call successful for account: " + item.getTecumName());
                if (responseBody != null && List.of("balance", "reward").contains(type)) {
                    var balance = JsonUtil.fromJson(JsonUtil.toJson(responseBody.getJson()), TecumRespone.TecumBalance.class);
                    if ("balance".equalsIgnoreCase(type)) {
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
                    } else if ("reward".equalsIgnoreCase(type)) {
                        jdbcTemplate.update("""
                                 update tecum_account
                                set commission               = IFNULL(:commission, commission)
                                where tecum_account_id = :tecum_account_id
                                """, new MapSqlParameterSource("tecum_account_id", item.getTecumAccountId())
                                .addValue("commission", balance.getAmount()));
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
