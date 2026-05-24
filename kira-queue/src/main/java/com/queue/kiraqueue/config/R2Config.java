package com.queue.kiraqueue.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;

import java.net.URI;

@Configuration
public class R2Config {

    @Bean(destroyMethod = "close")
    @ConditionalOnExpression("@r2Properties.isConfigured()")
    public S3Client r2S3Client(R2Properties properties) {
        var credentials = AwsBasicCredentials.create(properties.getAccessKey(), properties.getSecretKey());
        return S3Client.builder()
                .endpointOverride(URI.create(properties.getEndpoint()))
                .region(Region.US_EAST_1)
                .credentialsProvider(StaticCredentialsProvider.create(credentials))
                .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
                .build();
    }
}
