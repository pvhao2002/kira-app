package com.kira.bank.analytics.application;

import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class LoginVisitDtos {
    private LoginVisitDtos() {}
    public record VisitWrite(@NotNull UUID id, @NotNull UUID visitorId, @NotNull UUID sessionId,
        @NotNull @Pattern(regexp="navigate|reload|back_forward|spa") String navigation,
        @NotNull @Size(max=40) String language, @NotNull @Size(max=80) String timezone,
        @Min(0) @Max(32768) int screenWidth, @Min(0) @Max(32768) int screenHeight,
        @NotNull @Size(max=2000) String referrer) {}
    public record Totals(long views, long reloads, long ips, long visitors) {}
    public record IpRow(String ip, long views, long reloads, long visitors, long sessions,
        Instant firstSeen, Instant lastSeen) {}
    public record Event(String id, Instant visitedAt, String ip, String peerIp, String ipSource,
        String visitorId, String sessionId, String navigation, String userAgent, String language,
        String timezone, int screenWidth, int screenHeight, String referrer) {}
    public record Page<T>(List<T> items, long total, int page, int size) {}
    public record Report(Totals totals, Page<IpRow> ips, int retentionDays) {}
}
