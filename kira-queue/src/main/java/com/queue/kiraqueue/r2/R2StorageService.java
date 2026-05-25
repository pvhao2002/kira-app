//package com.queue.kiraqueue.r2;
//
//import com.queue.kiraqueue.config.R2Properties;
//import lombok.RequiredArgsConstructor;
//import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
//import org.springframework.stereotype.Service;
//import software.amazon.awssdk.core.sync.RequestBody;
//import software.amazon.awssdk.services.s3.S3Client;
//import software.amazon.awssdk.services.s3.model.PutObjectRequest;
//
//@Service
//@ConditionalOnBean(S3Client.class)
//@RequiredArgsConstructor
//public class R2StorageService {
//
//    private final S3Client s3Client;
//    private final R2Properties properties;
//
//    public String upload(String objectKey, byte[] content, String contentType) {
//        var request = PutObjectRequest.builder()
//                .bucket(properties.getBucket())
//                .key(objectKey)
//                .contentType(contentType)
//                .build();
//        s3Client.putObject(request, RequestBody.fromBytes(content));
//        var base = properties.getPublicBaseUrl();
//        if (base.endsWith("/")) {
//            return base + objectKey;
//        }
//        return base + "/" + objectKey;
//    }
//}
