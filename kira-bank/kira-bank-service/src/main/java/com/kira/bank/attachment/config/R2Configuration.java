package com.kira.bank.attachment.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

import java.net.URI;

@Configuration
@EnableConfigurationProperties(R2Properties.class)
public class R2Configuration {

    @Bean
    S3Client r2S3Client(R2Properties props) {
        return S3Client.builder()
            .endpointOverride(URI.create("https://" + props.accountId() + ".r2.cloudflarestorage.com"))
            .region(Region.of("auto"))
            .credentialsProvider(StaticCredentialsProvider.create(
                AwsBasicCredentials.create(props.accessKeyId(), props.secretAccessKey())
            ))
            .build();
    }
}
