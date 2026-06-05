package com.db.kiragateway.useradmin.repository;

import com.db.kiragateway.useradmin.model.UserAdminRow;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Repository
public class UserAdminRepository {

    private final JdbcClient jdbcClient;

    public UserAdminRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public long count(String usernameLikePattern, String statusFilter, String roleFilter) {
        var where = buildWhereClause(usernameLikePattern, statusFilter, roleFilter);
        var sql = "select count(*) from users " + where.sql();
        var spec = jdbcClient.sql(sql);
        for (var p : where.params()) {
            spec = spec.param(p.name(), p.value());
        }
        return spec.query((rs, rowNum) -> rs.getLong(1)).single();
    }

    public List<UserAdminRow> findPage(
            String usernameLikePattern,
            String statusFilter,
            String roleFilter,
            String orderByColumn,
            String orderDir,
            int offset,
            int limit
    ) {
        var where = buildWhereClause(usernameLikePattern, statusFilter, roleFilter);
        var sql = """
                select user_id, username, status, role, avatar, created_at, updated_at
                from users
                """ + where.sql() + " order by " + orderByColumn + " " + orderDir + " limit :limit offset :offset";

        var spec = jdbcClient.sql(sql).param("limit", limit).param("offset", offset);
        for (var p : where.params()) {
            spec = spec.param(p.name(), p.value());
        }
        return spec.query(this::mapRow).list();
    }

    private WhereClause buildWhereClause(String usernameLikePattern, String statusFilter, String roleFilter) {
        var sql = new StringBuilder("where 1=1");
        var params = new ArrayList<NamedParam>();
        if (usernameLikePattern != null) {
            sql.append(" and username like :usernameLike escape '!'");
            params.add(new NamedParam("usernameLike", usernameLikePattern));
        }
        if (statusFilter != null) {
            if ("active".equalsIgnoreCase(statusFilter)) {
                sql.append(" and lower(status) in ('active', 'enabled')");
            } else {
                sql.append(" and lower(status) = lower(:statusFilter)");
                params.add(new NamedParam("statusFilter", statusFilter));
            }
        }
        if (roleFilter != null) {
            sql.append(" and lower(role) = lower(:roleFilter)");
            params.add(new NamedParam("roleFilter", roleFilter));
        }
        return new WhereClause(sql.toString(), params);
    }

    public Optional<UserAdminRow> findById(int userId) {
        var sql = """
                select user_id, username, status, role, avatar, created_at, updated_at
                from users
                where user_id = :userId
                limit 1
                """;
        return jdbcClient.sql(sql)
                .param("userId", userId)
                .query(this::mapRow)
                .optional();
    }

    public Optional<UserAdminRow> findByUsername(String username) {
        return findByUsernameInternal(username);
    }

    public Optional<UserAdminRow> findByUsernameForWrite(String username) {
        return findByUsernameInternal(username);
    }

    private Optional<UserAdminRow> findByUsernameInternal(String username) {
        var sql = """
                select user_id, username, status, role, avatar, created_at, updated_at
                from users
                where username = :username
                limit 1
                """;
        return jdbcClient.sql(sql)
                .param("username", username)
                .query(this::mapRow)
                .optional();
    }

    public boolean existsByUsername(String username) {
        return existsByUsernameInternal(username);
    }

    public boolean existsByUsernameForWrite(String username) {
        return existsByUsernameInternal(username);
    }

    private boolean existsByUsernameInternal(String username) {
        var sql = """
                select 1 from users where username = :username limit 1
                """;
        return jdbcClient.sql(sql)
                .param("username", username)
                .query((rs, rowNum) -> true)
                .optional()
                .isPresent();
    }

    public int insert(String username, String passwordHash, String status, String role) {
        var sql = """
                insert into users (username, password, status, role, avatar)
                values (:username, :password, :status, :role, null)
                """;
        return jdbcClient.sql(sql)
                .param("username", username)
                .param("password", passwordHash)
                .param("status", status)
                .param("role", role)
                .update();
    }

    public int updateRoleStatus(int userId, String role, String status) {
        if (role == null && status == null) {
            return 0;
        }
        if (role != null && status != null) {
            var sql = """
                    update users set role = :role, status = :status where user_id = :userId
                    """;
            return jdbcClient.sql(sql)
                    .param("role", role)
                    .param("status", status)
                    .param("userId", userId)
                    .update();
        }
        if (role != null) {
            return jdbcClient.sql("update users set role = :role where user_id = :userId")
                    .param("role", role)
                    .param("userId", userId)
                    .update();
        }
        return jdbcClient.sql("update users set status = :status where user_id = :userId")
                .param("status", status)
                .param("userId", userId)
                .update();
    }

    public int updatePassword(int userId, String passwordHash) {
        var sql = """
                update users set password = :password where user_id = :userId
                """;
        return jdbcClient.sql(sql)
                .param("password", passwordHash)
                .param("userId", userId)
                .update();
    }

    public int deleteById(int userId) {
        return jdbcClient.sql("delete from users where user_id = :userId")
                .param("userId", userId)
                .update();
    }

    private UserAdminRow mapRow(ResultSet rs, int rowNum) throws SQLException {
        var created = rs.getTimestamp("created_at");
        var updated = rs.getTimestamp("updated_at");
        return new UserAdminRow(
                rs.getInt("user_id"),
                rs.getString("username"),
                rs.getString("status"),
                rs.getString("role"),
                rs.getString("avatar"),
                created != null ? created.toLocalDateTime() : null,
                updated != null ? updated.toLocalDateTime() : null
        );
    }

    private record NamedParam(String name, Object value) {
    }

    private record WhereClause(String sql, List<NamedParam> params) {
    }
}
