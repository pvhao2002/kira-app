package kira.crawl.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.playwright")
public record PlaywrightProperties(
        boolean headless,
        String channel,
        long browserTimeoutMs,
        long matchesAsyncTimeoutMs,
        long oddsAsyncTimeoutMs,
        String userAgent,
        String acceptLanguage,
        String cookie,
        String profileBaseDir,
        String profileInstanceId,
        int serverPort,
        int matchesConcurrency,
        int oddsConcurrency,
        long acquireTimeoutMs
) {
    /**
     * Unique per JVM: {@code port4000_pid12345}. Prevents two processes on the same HTTP port from sharing Chromium user-data.
     */
    public String resolvedProfileInstanceId() {
        var label = profileInstanceId != null && !profileInstanceId.isBlank()
                ? profileInstanceId
                : "port" + serverPort;
        return label + "_pid" + ProcessHandle.current().pid();
    }
}
