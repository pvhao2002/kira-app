package com.kira.affiliate.order.application;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "shopee.sync.enabled", havingValue = "true", matchIfMissing = true)
public class SyncScheduler {
    private final SyncService sync;

    // Runs on a virtual thread (spring.threads.virtual.enabled); overlapping passes are skipped inside the service.
    @Scheduled(cron = "${shopee.sync.cron}", zone = "${shopee.sync.time-zone:Asia/Ho_Chi_Minh}")
    void syncAllUsers() {
        sync.runScheduledPass();
    }
}
