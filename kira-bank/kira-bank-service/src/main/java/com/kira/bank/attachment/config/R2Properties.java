package com.kira.bank.attachment.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "r2")
public record R2Properties(
    String accountId,
    String accessKeyId,
    String secretAccessKey,
    String bucketName,
    String publicUrl
) {
}
