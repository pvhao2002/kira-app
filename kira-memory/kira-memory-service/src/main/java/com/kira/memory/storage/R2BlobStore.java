package com.kira.memory.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.checksums.RequestChecksumCalculation;
import software.amazon.awssdk.core.checksums.ResponseChecksumValidation;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.http.ContentStreamProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.CompletedPart;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import org.springframework.util.unit.DataSize;

import java.net.URI;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/** Cloudflare R2 through its S3-compatible API. */
@Component
public class R2BlobStore implements BlobStore {
    private final String bucket;
    private final S3Client s3;
    private final long partSize;

    public R2BlobStore(@Value("${storage.r2.endpoint}") String endpoint, @Value("${storage.r2.bucket}") String bucket,
                       @Value("${storage.r2.access-key}") String accessKey,
                       @Value("${storage.r2.secret-key}") String secretKey, @Value("${storage.r2.region}") String region,
                       @Value("${storage.r2.part-size}") DataSize partSize) {
        this.bucket = bucket;
        this.partSize = partSize.toBytes();
        boolean ok = !endpoint.isBlank() && !bucket.isBlank() && !accessKey.isBlank() && !secretKey.isBlank();
        this.s3 = !ok ? null : S3Client.builder().endpointOverride(URI.create(endpoint)).region(Region.of(region))
            .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey)))
            .forcePathStyle(true)
            // R2 does not accept every default checksum the SDK sends since 2.30.
            .requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
            .responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED)
            .build();
    }

    @Override
    public StorageProvider provider() {
        return StorageProvider.R2;
    }

    @Override
    public boolean configured() {
        return s3 != null;
    }

    @Override
    public void put(List<Upload> files) {
        for (Upload f : files) putOne(f.key(), f.file(), f.contentType());
    }

    private void putOne(String key, Path file, String contentType) {
        try {
            long size = Files.size(file);
            if (size <= partSize) {
                client().putObject(b -> b.bucket(bucket).key(key).contentType(contentType), RequestBody.fromFile(file));
            } else {
                putMultipart(key, file, contentType, size);
            }
        } catch (SdkException | IOException e) {
            throw new StorageException("R2 upload failed", e);
        }
    }

    /** Big files go up in parts: a failed part is retried alone instead of resending gigabytes. */
    private void putMultipart(String key, Path file, String contentType, long size) {
        String uploadId = client().createMultipartUpload(b -> b.bucket(bucket).key(key).contentType(contentType)).uploadId();
        try {
            List<CompletedPart> parts = new ArrayList<>();
            for (int n = 1; (long) (n - 1) * partSize < size; n++) {
                long offset = (n - 1) * partSize;
                long length = Math.min(partSize, size - offset);
                int partNumber = n;
                // A provider (not a stream) so the SDK can reopen the slice when it retries the part.
                ContentStreamProvider slice = () -> FileSlice.open(file, offset, length);
                String etag = client().uploadPart(b -> b.bucket(bucket).key(key).uploadId(uploadId).partNumber(partNumber)
                    .contentLength(length), RequestBody.fromContentProvider(slice, length, contentType)).eTag();
                parts.add(CompletedPart.builder().partNumber(partNumber).eTag(etag).build());
            }
            client().completeMultipartUpload(b -> b.bucket(bucket).key(key).uploadId(uploadId)
                .multipartUpload(m -> m.parts(parts)));
        } catch (RuntimeException e) {
            try {
                client().abortMultipartUpload(b -> b.bucket(bucket).key(key).uploadId(uploadId));
            } catch (SdkException ignored) {
                // R2 also expires abandoned multipart uploads on its own.
            }
            throw e;
        }
    }

    @Override
    public Blob open(String key, String range) {
        try {
            ResponseInputStream<GetObjectResponse> in = client().getObject(b -> b.bucket(bucket).key(key).range(range));
            GetObjectResponse r = in.response();
            boolean partial = range != null && r.contentRange() != null;
            return new Blob(partial ? 206 : 200, in, r.contentLength(), partial ? r.contentRange() : null);
        } catch (NoSuchKeyException e) {
            throw new StorageNotFoundException();
        } catch (SdkException e) {
            throw new StorageException("R2 download failed", e);
        }
    }

    @Override
    public void delete(String key) {
        try {
            client().deleteObject(b -> b.bucket(bucket).key(key));
        } catch (SdkException e) {
            throw new StorageException("R2 delete failed", e);
        }
    }

    private S3Client client() {
        if (s3 == null) throw new StorageException("R2 is not configured");
        return s3;
    }
}
