package com.kira.bank.notification.application;

import com.kira.bank.notification.domain.Notification;
import com.kira.bank.notification.infrastructure.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class NotificationService {
    private final NotificationRepository notifications;

    @Transactional
    public void createIfAbsent(Long userId, String type, String module, String title,
                               String message, String severity, String deepLink) {
        if (notifications.existsByUserIdAndTypeAndDeepLinkAndDeletedAtIsNull(userId, type, deepLink)) {
            return;
        }
        Notification notification = new Notification();
        notification.setUserId(userId);
        notification.setType(type);
        notification.setModule(module);
        notification.setTitle(title);
        notification.setMessage(message);
        notification.setSeverity(severity);
        notification.setDeepLink(deepLink);
        notification.setCreatedBy(userId);
        notification.setUpdatedBy(userId);
        notifications.save(notification);
    }
}
