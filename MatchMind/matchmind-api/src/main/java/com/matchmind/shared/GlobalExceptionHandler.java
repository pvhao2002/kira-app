package com.matchmind.shared;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.TypeMismatchException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

import static com.matchmind.shared.ApiTypes.ErrorResponse;

/** Maps every failure to ErrorResponse. Clients never see stack traces, SQL or internal class names. */
@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ErrorResponse> api(ApiException ex, HttpServletRequest request) {
        if (ex.getStatus().is5xxServerError()) {
            log.error("API request failed traceId={} path={} status={} code={}", traceId(), request.getRequestURI(),
                ex.getStatus().value(), ex.getCode(), ex);
        } else {
            log.warn("API request rejected traceId={} path={} status={} code={}", traceId(), request.getRequestURI(),
                ex.getStatus().value(), ex.getCode());
        }
        return ResponseEntity.status(ex.getStatus()).headers(ex.getHeaders())
            .body(error(ex.getStatus(), ex.getCode(), ex.getMessage(), ex.getFieldErrors(), request));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ErrorResponse> validation(MethodArgumentNotValidException ex, HttpServletRequest request) {
        Map<String, String> fields = new LinkedHashMap<>();
        for (FieldError e : ex.getBindingResult().getFieldErrors()) fields.putIfAbsent(e.getField(), e.getDefaultMessage());
        ex.getBindingResult().getGlobalErrors().forEach(e -> fields.putIfAbsent(e.getObjectName(), e.getDefaultMessage()));
        return response(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Request validation failed", fields, request);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ErrorResponse> malformed(HttpMessageNotReadableException ex, HttpServletRequest request) {
        return response(HttpStatus.BAD_REQUEST, "MALFORMED_REQUEST", "Request body is not valid JSON for this endpoint",
            Map.of(), request);
    }

    @ExceptionHandler({TypeMismatchException.class, ConstraintViolationException.class, IllegalArgumentException.class})
    ResponseEntity<ErrorResponse> invalidParameter(Exception ex, HttpServletRequest request) {
        log.warn("Invalid parameter traceId={} path={} exception={}", traceId(), request.getRequestURI(),
            ex.getClass().getSimpleName());
        return response(HttpStatus.BAD_REQUEST, "INVALID_PARAMETER", "Invalid request parameter", Map.of(), request);
    }

    @ExceptionHandler(AuthenticationException.class)
    ResponseEntity<ErrorResponse> unauthenticated(AuthenticationException ex, HttpServletRequest request) {
        return response(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Authentication required", Map.of(), request);
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ErrorResponse> forbidden(AccessDeniedException ex, HttpServletRequest request) {
        return response(HttpStatus.FORBIDDEN, "FORBIDDEN", "You are not allowed to perform this action", Map.of(), request);
    }

    @ExceptionHandler(OptimisticLockingFailureException.class)
    ResponseEntity<ErrorResponse> concurrent(OptimisticLockingFailureException ex, HttpServletRequest request) {
        return response(HttpStatus.CONFLICT, "CONCURRENT_UPDATE", "The record was changed by someone else; reload it",
            Map.of(), request);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ErrorResponse> integrity(DataIntegrityViolationException ex, HttpServletRequest request) {
        // The SQL message names tables/constraints: log the type only, never return it.
        log.warn("Data integrity violation traceId={} path={} cause={}", traceId(), request.getRequestURI(),
            ex.getMostSpecificCause().getClass().getSimpleName());
        return response(HttpStatus.CONFLICT, "DATA_CONFLICT", "The data conflicts with existing records", Map.of(), request);
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ErrorResponse> unexpected(Exception ex, HttpServletRequest request) {
        if (ex instanceof org.springframework.web.ErrorResponse framework && framework.getStatusCode().is4xxClientError()) {
            HttpStatus status = HttpStatus.resolve(framework.getStatusCode().value());
            if (status == null) status = HttpStatus.BAD_REQUEST;
            return ResponseEntity.status(status).headers(framework.getHeaders())
                .body(error(status, status.name(), status.getReasonPhrase(), Map.of(), request));
        }
        log.error("Unhandled exception traceId={} path={} exception={}", traceId(), request.getRequestURI(),
            ex.getClass().getSimpleName(), ex);
        return response(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Unexpected server error", Map.of(), request);
    }

    private ResponseEntity<ErrorResponse> response(HttpStatus status, String code, String message,
                                                   Map<String, String> fields, HttpServletRequest request) {
        return ResponseEntity.status(status).body(error(status, code, message, fields, request));
    }

    private ErrorResponse error(HttpStatus status, String code, String message, Map<String, String> fields,
                                HttpServletRequest request) {
        return new ErrorResponse(Instant.now(), status.value(), code, message, fields, request.getRequestURI(), traceId());
    }

    private String traceId() {
        return MDC.get("traceId");
    }
}
