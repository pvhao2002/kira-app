package com.kira.bank.attachment;

import com.kira.bank.attachment.config.R2Properties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.core.sync.ResponseTransformer;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;

@Service
@RequiredArgsConstructor
public class R2StorageService {

    private final S3Client r2S3Client;
    private final R2Properties r2Properties;

    /**
     * Upload bytes lên Cloudflare R2 bucket.
     *
     * @param key         relative key (vd: "42/550e8400-...uuid....jpg")
     * @param data        nội dung file dưới dạng byte array
     * @param contentType MIME type (vd: "image/jpeg")
     */
    public void upload(String key, byte[] data, String contentType) {
        PutObjectRequest request = PutObjectRequest.builder()
            .bucket(r2Properties.bucketName())
            .key(key)
            .contentType(contentType)
            .contentLength((long) data.length)
            .build();
        r2S3Client.putObject(request, RequestBody.fromBytes(data));
    }

    public byte[] download(String key) {
        return r2S3Client.getObject(
            GetObjectRequest.builder().bucket(r2Properties.bucketName()).key(key).build(),
            ResponseTransformer.toBytes()
        ).asByteArray();
    }

    public void delete(String key) {
        r2S3Client.deleteObject(DeleteObjectRequest.builder()
            .bucket(r2Properties.bucketName()).key(key).build());
    }

    /**
     * Trả về public URL của file trên R2 (nếu bucket đã được cấu hình public domain).
     * Nếu publicUrl chưa được cấu hình, trả về null.
     */
    public String getPublicUrl(String key) {
        String base = r2Properties.publicUrl();
        if (base == null || base.isBlank()) return null;
        return base.endsWith("/") ? base + key : base + "/" + key;
    }
}
