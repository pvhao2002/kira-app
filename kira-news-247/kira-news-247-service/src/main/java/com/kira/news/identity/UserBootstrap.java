package com.kira.news.identity;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/** Creates the owner (ADMIN) and the AI agent (EDITOR) accounts from env on first start. Existing users are untouched. */
@Component
@EnableConfigurationProperties(UserBootstrap.Accounts.class)
public class UserBootstrap implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(UserBootstrap.class);

    @ConfigurationProperties("news.bootstrap")
    public record Accounts(Account admin, Account editor) {
    }

    public record Account(String username, String password, String displayName) {
        boolean configured() {
            return username != null && !username.isBlank() && password != null && !password.isBlank();
        }
    }

    private final Accounts accounts;
    private final NewsUserRepository users;
    private final PasswordEncoder encoder;

    public UserBootstrap(Accounts accounts, NewsUserRepository users, PasswordEncoder encoder) {
        this.accounts = accounts;
        this.users = users;
        this.encoder = encoder;
    }

    @Override
    public void run(ApplicationArguments args) {
        create(accounts.admin(), Role.ADMIN);
        create(accounts.editor(), Role.EDITOR);
    }

    private void create(Account account, Role role) {
        if (account == null || !account.configured() || users.existsByUsername(account.username())) {
            return;
        }
        if (account.password().length() < 12) {
            throw new IllegalStateException("Bootstrap password for " + role + " must be at least 12 characters");
        }
        users.save(new NewsUser(account.username(), account.displayName(), encoder.encode(account.password()), role));
        log.info("Created {} account '{}'", role, account.username());
    }
}
