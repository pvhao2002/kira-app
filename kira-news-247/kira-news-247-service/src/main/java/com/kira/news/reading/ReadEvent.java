package com.kira.news.reading;

import jakarta.persistence.*;

import java.time.Instant;

/** One article view, enriched in the reader's browser by ipinfo.io. */
@Entity
@Table(name = "read_event")
public class ReadEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Long articleId;
    private Instant readAt;
    private String visitorId;
    private String sessionId;
    private String ip;
    private String hostname;
    private String city;
    private String region;
    private String country;
    private String loc;
    private String org;
    private String postal;
    private String timezone;
    private String remoteIp;
    private String userAgent;
    private String referrer;
    private String language;
    private Integer screenWidth;
    private Integer screenHeight;

    protected ReadEvent() {
    }

    public ReadEvent(long articleId, String visitorId, String sessionId, com.kira.news.proto.v1.IpInfo info,
                     String remoteIp, String userAgent, String referrer, String language, int screenWidth, int screenHeight) {
        this.articleId = articleId;
        this.readAt = Instant.now();
        this.visitorId = visitorId;
        this.sessionId = sessionId;
        this.ip = cut(info.getIp(), 64);
        this.hostname = cut(info.getHostname(), 255);
        this.city = cut(info.getCity(), 120);
        this.region = cut(info.getRegion(), 120);
        this.country = cut(info.getCountry(), 8);
        this.loc = cut(info.getLoc(), 40);
        this.org = cut(info.getOrg(), 255);
        this.postal = cut(info.getPostal(), 20);
        this.timezone = cut(info.getTimezone(), 64);
        this.remoteIp = cut(remoteIp, 64);
        this.userAgent = cut(userAgent, 500);
        this.referrer = cut(referrer, 1000);
        this.language = cut(language, 40);
        this.screenWidth = Math.clamp(screenWidth, 0, 100_000);
        this.screenHeight = Math.clamp(screenHeight, 0, 100_000);
    }

    /** Analytics fields are truncated, not rejected: a long ISP name must not lose the read. */
    static String cut(String value, int max) {
        if (value == null || value.isBlank()) {
            return null;
        }
        var trimmed = value.strip();
        return trimmed.length() <= max ? trimmed : trimmed.substring(0, max);
    }

    public com.kira.news.proto.v1.ReadRow toProto(String articleTitle, String articleSlug) {
        return com.kira.news.proto.v1.ReadRow.newBuilder()
                .setId(id)
                .setReadAt(readAt.toEpochMilli())
                .setArticleTitle(articleTitle)
                .setArticleSlug(articleSlug)
                .setIpInfo(com.kira.news.proto.v1.IpInfo.newBuilder()
                        .setIp(t(ip)).setHostname(t(hostname)).setCity(t(city)).setRegion(t(region))
                        .setCountry(t(country)).setLoc(t(loc)).setOrg(t(org)).setPostal(t(postal)).setTimezone(t(timezone)))
                .setRemoteIp(t(remoteIp))
                .setUserAgent(t(userAgent))
                .setReferrer(t(referrer))
                .setVisitorId(t(visitorId))
                .build();
    }

    private static String t(String value) {
        return value == null ? "" : value;
    }
}
