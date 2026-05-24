package com.queue.kiraqueue.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;

@Getter
@Setter
@ConfigurationProperties(prefix = "r2")
public class R2Properties {

    private String endpoint = "";
    private String accessKey = "";
    private String secretKey = "";
    private String bucket = "";
    private String publicBaseUrl = "";
    private Quota quota = new Quota();

    public boolean isConfigured() {
        return StringUtils.hasText(endpoint)
                && StringUtils.hasText(accessKey)
                && StringUtils.hasText(secretKey)
                && StringUtils.hasText(bucket)
                && StringUtils.hasText(publicBaseUrl);
    }

    @Getter
    @Setter
    public static class Quota {
        private long maxStorageBytes = 10_737_418_240L;
        private long maxClassAOpsMonth = 1_000_000L;
        private int warnAtPercent = 90;
    }
}
