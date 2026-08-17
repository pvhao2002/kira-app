package com.kira.bank.notification.web;

import com.kira.bank.notification.domain.Notification;
import com.kira.bank.notification.infrastructure.NotificationRepository;
import com.kira.bank.shared.web.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Map;

import static com.kira.bank.shared.web.ApiTypes.PageMeta;
import static com.kira.bank.shared.web.ApiTypes.PageResponse;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {
    private final NotificationRepository repository;

    @GetMapping
    @Transactional(readOnly = true)
    Object list(@AuthenticationPrincipal Long user, @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        Page<Notification> p = repository.findByUserIdAndDeletedAtIsNull(user, pageable);
        return new PageResponse<>(p.getContent(), new PageMeta(p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages()));
    }

    @GetMapping("/unread-count")
    Object unread(@AuthenticationPrincipal Long user) {
        return Map.of("count", repository.countByUserIdAndReadAtIsNull(user));
    }

    @PatchMapping("/{id}/read")
    @Transactional
    Object read(@AuthenticationPrincipal Long user, @PathVariable Long id) {
        Notification n = repository.findByIdAndUserIdAndDeletedAtIsNull(id, user).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOTIFICATION_NOT_FOUND", "Không tìm thấy thông báo"));
        if (n.getReadAt() == null) n.setReadAt(Instant.now());
        return n;
    }
}
