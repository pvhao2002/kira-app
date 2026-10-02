package com.kira.farm.identity.infrastructure;

import com.kira.farm.identity.application.PasswordResetNotifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/** Every profile except dev: no mail is configured, so nothing is sent and the token is NOT logged. */
@Component
@Profile("!dev")
public class NoopPasswordResetNotifier implements PasswordResetNotifier {
    private static final Logger log = LoggerFactory.getLogger(NoopPasswordResetNotifier.class);

    @Override
    public void sendResetLink(String email, String link) {
        log.warn("Password reset requested but no mail sender is configured; the link was not delivered");
    }
}
