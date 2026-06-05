package com.db.kiragateway.auth.repository;

import com.db.kiragateway.auth.model.UserCredential;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public class UserAuthRepository {

    private final JdbcClient jdbcClient;

    public UserAuthRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public Optional<UserCredential> findByUsername(String username) {
        var sql = """
                select user_id, username, password, status, role, avatar
                from users
                where username = :username
                limit 1
                """;

        return jdbcClient.sql(sql)
                .param("username", username)
                .query((rs, rowNum) -> mapUser(rs))
                .optional();
    }

    public Optional<UserCredential> findByUserId(int userId) {
        var sql = """
                select user_id, username, password, status, role, avatar
                from users
                where user_id = :userId
                limit 1
                """;

        return jdbcClient.sql(sql)
                .param("userId", userId)
                .query((rs, rowNum) -> mapUser(rs))
                .optional();
    }

    public int insertUser(String username, String passwordHash, String status, String role, String avatar) {
        var sql = """
                insert into users (username, password, status, role, avatar)
                values (:username, :password, :status, :role, :avatar)
                """;

        return jdbcClient
                .sql(sql)
                .param("username", username)
                .param("password", passwordHash)
                .param("status", status)
                .param("role", role)
                .param("avatar", avatar)
                .update();
    }

    public int updatePasswordByUsername(String username, String passwordHash) {
        var sql = """
                update users
                set password = :password
                where username = :username
                """;
        return jdbcClient
                .sql(sql)
                .param("username", username)
                .param("password", passwordHash)
                .update();
    }

    private UserCredential mapUser(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new UserCredential(
                rs.getInt("user_id"),
                rs.getString("username"),
                rs.getString("password"),
                rs.getString("status"),
                rs.getString("role"),
                rs.getString("avatar")
        );
    }
}
