package com.matchmind.security;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Creates the first ADMIN from MATCHMIND_ADMIN_USERNAME / MATCHMIND_ADMIN_PASSWORD when the users table is empty.
 * Nothing is hard-coded: without both variables no account is created. Later restarts never touch existing users.
 */
@Component
@RequiredArgsConstructor
public class AdminBootstrap implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);
    private final UserRepository users;
    private final PasswordEncoder encoder;
    @Value("${app.bootstrap-admin.username:}")
    private String username;
    @Value("${app.bootstrap-admin.password:}")
    private String password;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (users.count() > 0) return;
        if (username.isBlank() || password.isBlank()) {
            log.warn("No users exist and MATCHMIND_ADMIN_USERNAME/MATCHMIND_ADMIN_PASSWORD are not set; nobody can log in");
            return;
        }
        if (password.length() < 10) throw new IllegalStateException("MATCHMIND_ADMIN_PASSWORD must be at least 10 characters");
        if (AuthService.tooLongForBcrypt(password)) {
            throw new IllegalStateException("MATCHMIND_ADMIN_PASSWORD must be at most 72 bytes (accented letters count as 2-3 bytes)");
        }
        User admin = new User();
        admin.setUsername(username.trim());
        admin.setPasswordHash(encoder.encode(password));
        admin.setRole("ADMIN");
        users.save(admin);
        log.info("Initial admin account '{}' created", admin.getUsername());
    }
}
