package com.kira.bank.shared.web;

import lombok.Getter;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

@Getter
public class ApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    private final HttpHeaders headers;

    public ApiException(HttpStatus status, String code, String message) {
        this(status, code, message, new HttpHeaders());
    }

    public ApiException(HttpStatus status, String code, String message, HttpHeaders headers) {
        super(message);
        this.status = status;
        this.code = code;
        this.headers = HttpHeaders.readOnlyHttpHeaders(headers);
    }
}
