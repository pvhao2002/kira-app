package com.kira.bank.notification.infrastructure;

import com.kira.bank.notification.domain.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    Page<Notification> findByUserIdAndDeletedAtIsNull(Long user, Pageable p);

    Optional<Notification> findByIdAndUserIdAndDeletedAtIsNull(Long id, Long user);

    long countByUserIdAndReadAtIsNullAndDeletedAtIsNull(Long user);

    boolean existsByUserIdAndTypeAndDeepLinkAndDeletedAtIsNull(Long userId, String type, String deepLink);

    @Modifying
    @Query("update Notification n set n.readAt = CURRENT_TIMESTAMP where n.userId = :userId and n.readAt is null and n.deletedAt is null")
    int markAllRead(@Param("userId") Long userId);
}
