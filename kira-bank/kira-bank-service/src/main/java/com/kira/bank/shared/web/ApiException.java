package com.kira.bank.shared.web;

import lombok.Getter;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

import java.util.Map;

@Getter
public class ApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    private final HttpHeaders headers;
    private final Map<String, String> fieldErrors;

    public ApiException(HttpStatus status, String code, String message) {
        this(status, code, message, new HttpHeaders(), Map.of());
    }

    public ApiException(HttpStatus status, String code, String message, HttpHeaders headers) {
        this(status, code, message, headers, Map.of());
    }

    public ApiException(HttpStatus status, String code, String message, Map<String, String> fieldErrors) {
        this(status, code, message, new HttpHeaders(), fieldErrors);
    }

    public ApiException(HttpStatus status, String code, String message, HttpHeaders headers,
                        Map<String, String> fieldErrors) {
        super(message);
        this.status = status;
        this.code = code;
        this.headers = HttpHeaders.readOnlyHttpHeaders(headers);
        this.fieldErrors = Map.copyOf(fieldErrors);
    }
}
