package com.kira.bank.notification.application;

import java.time.Instant;

public final class NotificationDtos {
    private NotificationDtos() {
    }

    public record NotificationResponse(Long id, String type, String module, String title,
                                       String message, String severity, Instant readAt,
                                       String deepLink, Instant createdAt) {
    }
}
