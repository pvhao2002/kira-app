package com.queue.kiraqueue.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.playwright")
public record PlaywrightProperties(
        boolean headless,
        String channel,
        long browserTimeoutMs,
        long verificationTimeoutMs,
        long matchesAsyncTimeoutMs,
        long oddsAsyncTimeoutMs,
        String acceptLanguage,
        String cookie,
        String profileBaseDir,
        String profileInstanceId,
        int serverPort,
        int matchesConcurrency,
        int oddsConcurrency,
        long acquireTimeoutMs,
        String matchesBenchmarkBaseUrl
) {
    /**
     * Stable across JVM restarts (e.g. {@code port2323}) so the Chromium user-data dir, and any
     * Cloudflare clearance cookie stored in it, survives a service restart. Deliberately excludes
     * the process id: only one instance is expected to bind a given port/profile-instance-id at a
     * time, and Playwright's own user-data-dir lock prevents two concurrent processes from sharing it.
     */
    public String resolvedProfileInstanceId() {
        return profileInstanceId != null && !profileInstanceId.isBlank()
                ? profileInstanceId
                : "port" + serverPort;
    }
}
