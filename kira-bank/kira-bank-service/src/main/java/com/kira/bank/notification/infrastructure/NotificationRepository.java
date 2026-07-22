package com.kira.bank.notification.infrastructure;

import com.kira.bank.notification.domain.Notification;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    Page<Notification> findByUserIdAndDeletedAtIsNull(Long user, Pageable p);

    Optional<Notification> findByIdAndUserIdAndDeletedAtIsNull(Long id, Long user);

    long countByUserIdAndReadAtIsNull(Long user);
}

