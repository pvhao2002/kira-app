package com.kira.bank.notification.web;

import com.kira.bank.notification.domain.Notification;
import com.kira.bank.notification.domain.PushDevice;
import com.kira.bank.notification.infrastructure.NotificationRepository;
import com.kira.bank.notification.infrastructure.PushDeviceRepository;
import com.kira.bank.shared.web.ApiException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
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

import static com.kira.bank.notification.application.NotificationDtos.NotificationChanged;
import static com.kira.bank.notification.application.NotificationDtos.NotificationResponse;
import static com.kira.bank.notification.application.NotificationDtos.PushDeviceRemoveRequest;
import static com.kira.bank.notification.application.NotificationDtos.PushDeviceRequest;
import static com.kira.bank.shared.web.ApiTypes.PageMeta;
import static com.kira.bank.shared.web.ApiTypes.PageResponse;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {
    private final NotificationRepository repository;
    private final ApplicationEventPublisher events;
    private final PushDeviceRepository pushDevices;

    @GetMapping
    @Transactional(readOnly = true)
    Object list(@AuthenticationPrincipal Long user, @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        Page<NotificationResponse> p = repository.findByUserIdAndDeletedAtIsNull(user, pageable).map(NotificationResponse::of);
        return new PageResponse<>(p.getContent(), new PageMeta(p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages()));
    }

    @GetMapping("/unread-count")
    Object unread(@AuthenticationPrincipal Long user) {
        return Map.of("count", repository.countByUserIdAndReadAtIsNullAndDeletedAtIsNull(user));
    }

    @PatchMapping("/read-all")
    @Transactional
    Object readAll(@AuthenticationPrincipal Long user) {
        int updated = repository.markAllRead(user);
        if (updated > 0) events.publishEvent(new NotificationChanged(user, null));
        return Map.of("updated", updated);
    }

    @PatchMapping("/{id}/read")
    @Transactional
    Object read(@AuthenticationPrincipal Long user, @PathVariable Long id) {
        Notification n = repository.findByIdAndUserIdAndDeletedAtIsNull(id, user).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOTIFICATION_NOT_FOUND", "Không tìm thấy thông báo"));
        if (n.getReadAt() == null) {
            n.setReadAt(Instant.now());
            events.publishEvent(new NotificationChanged(user, null));
        }
        return NotificationResponse.of(n);
    }

    /** Registers this device's Expo push token; a token moves to whichever account last signed in on the device. */
    @PutMapping("/push-devices")
    @Transactional
    Object registerPushDevice(@AuthenticationPrincipal Long user, @Valid @RequestBody PushDeviceRequest body) {
        PushDevice device = pushDevices.findByToken(body.token()).orElseGet(PushDevice::new);
        if (device.getId() == null) device.setCreatedBy(user);
        device.setUserId(user);
        device.setToken(body.token());
        device.setPlatform(body.platform());
        device.setUpdatedBy(user);
        pushDevices.save(device);
        return Map.of("registered", true);
    }

    @DeleteMapping("/push-devices")
    @Transactional
    Object removePushDevice(@AuthenticationPrincipal Long user, @Valid @RequestBody PushDeviceRemoveRequest body) {
        return Map.of("removed", pushDevices.deleteByUserIdAndToken(user, body.token()));
    }
}
