package com.kira.bank.shared.web;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

import static com.kira.bank.shared.web.ApiTypes.ErrorResponse;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ErrorResponse> api(ApiException ex, HttpServletRequest request) {
        if (ex.getStatus().is5xxServerError()) {
            log.error("API request failed traceId={} method={} path={} status={} code={} message={}",
                traceId(), request.getMethod(), request.getRequestURI(), ex.getStatus().value(), ex.getCode(),
                safeLogMessage(ex), ex);
        } else {
            log.warn("API request failed traceId={} method={} path={} status={} code={} message={}",
                traceId(), request.getMethod(), request.getRequestURI(), ex.getStatus().value(), ex.getCode(),
                safeLogMessage(ex));
        }
        return ResponseEntity.status(ex.getStatus()).headers(ex.getHeaders()).body(error(
            ex.getStatus(), ex.getCode(), ex.getMessage(), Map.of(), request));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ErrorResponse> validation(MethodArgumentNotValidException ex, HttpServletRequest request) {
        Map<String, String> fields = new LinkedHashMap<>();
        for (FieldError e : ex.getBindingResult().getFieldErrors())
            fields.putIfAbsent(e.getField(), e.getDefaultMessage());
        log.warn("Request validation failed traceId={} method={} path={} errors={}",
            traceId(), request.getMethod(), request.getRequestURI(), fields);
        return response(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Dữ liệu không hợp lệ", fields, request);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ErrorResponse> malformedRequest(HttpMessageNotReadableException ex, HttpServletRequest request) {
        log.warn("Malformed request traceId={} method={} path={} cause={} message={}",
            traceId(), request.getMethod(), request.getRequestURI(),
            ex.getMostSpecificCause().getClass().getSimpleName(), "Dữ liệu gửi lên không hợp lệ");
        return response(HttpStatus.BAD_REQUEST, "MALFORMED_REQUEST", "Dữ liệu gửi lên không hợp lệ", Map.of(), request);
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ErrorResponse> unexpected(Exception ex, HttpServletRequest request) {
        log.error("Unhandled exception traceId={} method={} path={} exception={} message={}",
            traceId(), request.getMethod(), request.getRequestURI(), ex.getClass().getSimpleName(),
            safeLogMessage(ex), ex);
        return response(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Đã có lỗi xảy ra", Map.of(), request);
    }

    private ResponseEntity<ErrorResponse> response(HttpStatus status, String code, String message,
                                                   Map<String, String> fields, HttpServletRequest request) {
        return ResponseEntity.status(status).body(error(status, code, message, fields, request));
    }

    private ErrorResponse error(HttpStatus status, String code, String message,
                                Map<String, String> fields, HttpServletRequest request) {
        return new ErrorResponse(Instant.now(), status.value(), code, message,
            fields, request.getRequestURI(), traceId());
    }

    private String traceId() {
        return MDC.get("traceId");
    }

    private String safeLogMessage(Throwable ex) {
        String message = ex.getMessage();
        if (message == null || message.isBlank()) return ex.getClass().getSimpleName();
        String normalized = message.replace('\r', ' ').replace('\n', ' ');
        return normalized.length() <= 500 ? normalized : normalized.substring(0, 500) + "...";
    }
}
