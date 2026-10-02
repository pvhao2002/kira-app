package com.kira.farm.identity.infrastructure;

import com.kira.farm.identity.domain.Role;
import com.kira.farm.identity.domain.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Locale;

/**
 * Creates the very first ADMIN from APP_BOOTSTRAP_ADMIN_EMAIL / APP_BOOTSTRAP_ADMIN_PASSWORD (>= 12 chars), independent
 * of APP_SEED_DEVELOPMENT_USERS. Does nothing unless both are set, and only when no admin exists yet; it never
 * overwrites an existing user. Any admin row (even non-ACTIVE) counts as "exists". The new admin enrolls TOTP at first login. Email and password are never logged.
 */
@Component
@Order(0)
public class BootstrapAdminRunner implements ApplicationRunner {
    static final int MIN_PASSWORD = 12;
    private static final int MAX_PASSWORD_BYTES = 72; // bcrypt limit, same as AuthDtos
    private static final int MAX_EMAIL = 190;
    private static final int MAX_NAME = 120;
    private static final String DEFAULT_NAME = "Quản trị viên";
    private static final Logger log = LoggerFactory.getLogger(BootstrapAdminRunner.class);
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final String email;
    private final String password;
    private final String name;

    public BootstrapAdminRunner(UserRepository users, PasswordEncoder encoder,
                                @Value("${app.bootstrap-admin.email:}") String email,
                                @Value("${app.bootstrap-admin.password:}") String password,
                                @Value("${app.bootstrap-admin.name:}") String name) {
        this.users = users;
        this.encoder = encoder;
        this.email = email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
        this.password = password == null ? "" : password;
        this.name = name == null || name.isBlank() ? DEFAULT_NAME : name.trim();
    }

    @Override
    public void run(ApplicationArguments args) {
        if (email.isEmpty() || password.isEmpty()) {
            log.info("Bootstrap admin not configured; skipping");
            return;
        }
        if (password.length() < MIN_PASSWORD || password.getBytes(StandardCharsets.UTF_8).length > MAX_PASSWORD_BYTES) {
            log.warn("Bootstrap admin skipped: password must be {} characters to {} bytes", MIN_PASSWORD, MAX_PASSWORD_BYTES);
            return;
        }
        if (email.length() > MAX_EMAIL || name.length() > MAX_NAME || !email.matches("[^@\\s]+@[^@\\s]+")) {
            log.warn("Bootstrap admin skipped: email or name is malformed or too long");
            return;
        }
        if (users.existsByRole(Role.ADMIN) || users.existsByEmailIgnoreCase(email)) {
            log.info("Bootstrap admin skipped: an admin or the user already exists");
            return;
        }
        User u = new User();
        u.setEmail(email);
        u.setFullName(name);
        u.setRole(Role.ADMIN);
        u.setPasswordHash(encoder.encode(password));
        users.save(u);
        log.warn("Bootstrap admin created; remove APP_BOOTSTRAP_ADMIN_PASSWORD from the environment");
    }
}
