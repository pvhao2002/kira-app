package com.kira.farm.identity.infrastructure;

import com.kira.farm.identity.application.PasswordResetNotifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/** Development only (SPRING_PROFILES_ACTIVE=dev): prints the reset link so the flow can be tried without mail. */
@Component
@Profile("dev")
public class LoggingPasswordResetNotifier implements PasswordResetNotifier {
    private static final Logger log = LoggerFactory.getLogger(LoggingPasswordResetNotifier.class);

    @Override
    public void sendResetLink(String email, String link) {
        log.info("[dev] password reset link: {}", link);
    }
}
