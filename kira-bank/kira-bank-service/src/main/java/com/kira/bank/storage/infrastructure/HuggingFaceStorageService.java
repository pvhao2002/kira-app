package com.kira.bank.storage.infrastructure;

import com.kira.bank.shared.web.ApiException;
import com.kira.bank.storage.StorageProperties;
import jakarta.annotation.PreDestroy;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.checksums.RequestChecksumCalculation;
import software.amazon.awssdk.core.checksums.ResponseChecksumValidation;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.core.sync.ResponseTransformer;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Object;

import java.net.URI;

/** Hugging Face Storage Bucket via the S3 gateway; path-style and checksum settings follow the Hub docs. */
@Service
@EnableConfigurationProperties(StorageProperties.class)
public class HuggingFaceStorageService {
    private final StorageProperties.HuggingFace config;
    private final S3Client client;

    public HuggingFaceStorageService(StorageProperties properties) {
        this.config = properties.safeHuggingFace();
        this.client = config.configured() ? S3Client.builder()
            .endpointOverride(URI.create("https://s3.hf.co/" + config.namespace().trim()))
            .region(Region.US_EAST_1)
            .forcePathStyle(true)
            .requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
            .responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED)
            .credentialsProvider(StaticCredentialsProvider.create(
                AwsBasicCredentials.create(config.accessKeyId().trim(), config.secretAccessKey().trim())))
            .build() : null;
    }

    public boolean configured() {
        return client != null;
    }

    public void upload(String key, byte[] data, String contentType) {
        requireClient().putObject(PutObjectRequest.builder().bucket(bucket()).key(key)
            .contentType(contentType).contentLength((long) data.length).build(), RequestBody.fromBytes(data));
    }

    public byte[] download(String key) {
        return requireClient().getObject(GetObjectRequest.builder().bucket(bucket()).key(key).build(),
            ResponseTransformer.toBytes()).asByteArray();
    }

    public void delete(String key) {
        requireClient().deleteObject(DeleteObjectRequest.builder().bucket(bucket()).key(key).build());
    }

    public long usedBytes() {
        return requireClient().listObjectsV2Paginator(ListObjectsV2Request.builder().bucket(bucket()).build())
            .contents().stream().mapToLong(S3Object::size).sum();
    }

    private String bucket() {
        return config.bucket().trim();
    }

    private S3Client requireClient() {
        if (client == null) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "HUGGING_FACE_NOT_CONFIGURED",
                "Chưa cấu hình Hugging Face Storage Bucket");
        }
        return client;
    }

    @PreDestroy
    void close() {
        if (client != null) client.close();
    }
}
