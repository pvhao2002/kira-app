package com.kira.news.shared;

import com.kira.news.proto.v1.ApiError;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.http.converter.protobuf.ProtobufHttpMessageConverter;

import java.io.IOException;
import java.time.Instant;

/** All API payloads are protobuf; there is deliberately no JSON variant of this API. */
@Configuration
public class Protobuf {
    public static final String CONTENT_TYPE = "application/x-protobuf";
    public static final MediaType MEDIA_TYPE = MediaType.parseMediaType(CONTENT_TYPE);

    @Bean
    ProtobufHttpMessageConverter protobufHttpMessageConverter() {
        return new ProtobufHttpMessageConverter();
    }

    public static long millis(Instant instant) {
        return instant == null ? 0 : instant.toEpochMilli();
    }

    public static String text(String value) {
        return value == null ? "" : value;
    }

    /** For security filters that answer before Spring MVC runs. */
    public static void writeError(HttpServletResponse response, int status, String code, String message) throws IOException {
        response.setStatus(status);
        response.setContentType(CONTENT_TYPE);
        ApiError.newBuilder().setCode(code).setMessage(message).build().writeTo(response.getOutputStream());
    }
}
