package com.app.kira.config;

import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Component;

@Component
public class CustomerUserDetailsService implements UserDetailsService {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public CustomerUserDetailsService(NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        String sql = "SELECT * FROM users WHERE username = :username";
        var params = new java.util.HashMap<String, Object>();
        params.put("username", username);

        return jdbcTemplate.query(sql, params, BeanPropertyRowMapper.newInstance(UserAccount.class))
                .stream().findFirst()
                .orElseThrow(() -> new UsernameNotFoundException("Không tìm thấy email!"));
    }
}
