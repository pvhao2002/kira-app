package com.kira.memory.identity;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Each account's session version (users.session_version). A session cookie only counts while it carries the current
 * one, so moving an account to the next version signs it out everywhere.
 * ponytail: cached in memory per instance, so a change only reaches this instance; fine for one instance, read the
 * column per request (or use Redis) if it scales out. Restart after editing session_version by hand.
 */
@Component
public class SessionVersions {
    private final Map<Long, Integer> versions = new ConcurrentHashMap<>();
    private final JdbcClient jdbc;

    public SessionVersions(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** -1 for an account that does not exist, which no session carries. */
    public int current(long userId) {
        Integer v = versions.computeIfAbsent(userId, id -> load(id).orElse(null));
        return v == null ? -1 : v;
    }

    /** Stores a new password hash and moves the account to the next version; returns that version. */
    @Transactional
    public int setPassword(long userId, String passwordHash) {
        jdbc.sql("UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?")
            .params(passwordHash, userId).update();
        // Read inside the transaction: the row stays locked, so this is the version this change produced.
        int v = load(userId).orElseThrow();
        versions.put(userId, v);
        return v;
    }

    private Optional<Integer> load(long userId) {
        return jdbc.sql("SELECT session_version FROM users WHERE id = ?").param(userId).query(Integer.class).optional();
    }
}
