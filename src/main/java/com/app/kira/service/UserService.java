package com.app.kira.service;

import com.app.kira.config.UserAccount;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserService {
    private final NamedParameterJdbcTemplate jdbcTemplate;


    public void signUp(String username, String password) {
        String sql = "INSERT INTO users (username, password) VALUES (:username, :password)";
        var params = new java.util.HashMap<String, Object>();
        params.put("username", username);
        params.put("password", password);
        jdbcTemplate.update(sql, params);
    }

    public UserAccount findByUsername(String username) {
        String sql = "SELECT * FROM users WHERE username = :username";
        var params = new java.util.HashMap<String, Object>();
        params.put("username", username);
        return jdbcTemplate.query(sql, params, BeanPropertyRowMapper.newInstance(UserAccount.class))
                .stream()
                .findFirst()
                .orElse(null);
    }
}
