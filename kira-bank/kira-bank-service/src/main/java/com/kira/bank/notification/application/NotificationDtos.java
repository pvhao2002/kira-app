package com.kira.bank.notification.application;

import com.kira.bank.notification.domain.Notification;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public final class NotificationDtos {
    private NotificationDtos() {
    }

    public record NotificationResponse(Long id, String type, String module, String title,
                                       String message, String severity, Instant readAt,
                                       String deepLink, Instant createdAt) {
        public static NotificationResponse of(Notification n) {
            return new NotificationResponse(n.getId(), n.getType(), n.getModule(), n.getTitle(), n.getMessage(),
                n.getSeverity(), n.getReadAt(), n.getDeepLink(), n.getCreatedAt());
        }
    }

    /** Published when a user's notifications change; {@code created} is null for read/read-all. */
    public record NotificationChanged(Long userId, NotificationResponse created) {
    }

    private static final String EXPO_TOKEN = "^Expo(nent)?PushToken\\[[A-Za-z0-9_-]+]$";

    public record PushDeviceRequest(@NotBlank @Size(max = 255) @Pattern(regexp = EXPO_TOKEN) String token,
                                    @NotBlank @Pattern(regexp = "IOS|ANDROID") String platform) {
    }

    public record PushDeviceRemoveRequest(@NotBlank @Size(max = 255) String token) {
    }
}
