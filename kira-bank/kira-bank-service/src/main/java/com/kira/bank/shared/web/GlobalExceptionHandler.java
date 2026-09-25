package com.kira.bank.shared.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.TypeMismatchException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.mapping.PropertyReferenceException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestCookieException;
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
            ex.getStatus(), ex.getCode(), ex.getMessage(), ex.getFieldErrors(), request));
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

    @ExceptionHandler(MissingRequestCookieException.class)
    ResponseEntity<ErrorResponse> missingCookie(MissingRequestCookieException ex, HttpServletRequest request) {
        return response(HttpStatus.UNAUTHORIZED, "INVALID_REFRESH_TOKEN",
            "Phiên đăng nhập không hợp lệ hoặc đã hết hạn", Map.of(), request);
    }

    @ExceptionHandler({TypeMismatchException.class, ConstraintViolationException.class,
        PropertyReferenceException.class})
    ResponseEntity<ErrorResponse> invalidParameter(Exception ex, HttpServletRequest request) {
        log.warn("Invalid request parameter traceId={} method={} path={} exception={}",
            traceId(), request.getMethod(), request.getRequestURI(), ex.getClass().getSimpleName());
        return response(HttpStatus.BAD_REQUEST, "INVALID_PARAMETER", "Tham số không hợp lệ", Map.of(), request);
    }

    @ExceptionHandler(AuthenticationException.class)
    ResponseEntity<ErrorResponse> unauthenticated(AuthenticationException ex, HttpServletRequest request) {
        return response(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Bạn cần đăng nhập để tiếp tục", Map.of(), request);
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ErrorResponse> forbidden(AccessDeniedException ex, HttpServletRequest request) {
        log.warn("Access denied traceId={} method={} path={}", traceId(), request.getMethod(), request.getRequestURI());
        return response(HttpStatus.FORBIDDEN, "FORBIDDEN", "Bạn không có quyền thực hiện thao tác này", Map.of(), request);
    }

    @ExceptionHandler(OptimisticLockingFailureException.class)
    ResponseEntity<ErrorResponse> concurrentUpdate(OptimisticLockingFailureException ex, HttpServletRequest request) {
        log.warn("Concurrent update traceId={} method={} path={}", traceId(), request.getMethod(), request.getRequestURI());
        return response(HttpStatus.CONFLICT, "CONCURRENT_UPDATE", "Dữ liệu đã được cập nhật ở phiên khác", Map.of(),
            request);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ErrorResponse> dataConflict(DataIntegrityViolationException ex, HttpServletRequest request) {
        // The SQL message names tables/constraints, so it is only logged by type, never returned.
        log.warn("Data integrity violation traceId={} method={} path={} cause={}", traceId(), request.getMethod(),
            request.getRequestURI(), ex.getMostSpecificCause().getClass().getSimpleName());
        return response(HttpStatus.CONFLICT, "DATA_CONFLICT", "Dữ liệu bị trùng hoặc xung đột", Map.of(), request);
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ErrorResponse> unexpected(Exception ex, HttpServletRequest request) {
        if (ex instanceof org.springframework.web.ErrorResponse framework
            && framework.getStatusCode().is4xxClientError()) {
            // Spring MVC request errors (404, 405, 413, 415, missing parameter/part, ...). Their built-in details
            // mention handler and type names, so only a generic message per status goes to the client.
            HttpStatus status = HttpStatus.resolve(framework.getStatusCode().value());
            if (status == null) status = HttpStatus.BAD_REQUEST;
            log.warn("Request rejected traceId={} method={} path={} status={} exception={}", traceId(),
                request.getMethod(), request.getRequestURI(), status.value(), ex.getClass().getSimpleName());
            return ResponseEntity.status(status).headers(framework.getHeaders()).body(error(
                status, clientErrorCode(status), clientErrorMessage(status), Map.of(), request));
        }
        if (request.getRequestURI().startsWith("/api/v1/health") || request.getRequestURI().startsWith("/api/v1/auth/mobile")
            || request.getRequestURI().startsWith("/api/v1/travel")) {
            log.error("Private request failed traceId={} method={} path={} exception={}",
                traceId(), request.getMethod(), request.getRequestURI(), ex.getClass().getSimpleName());
            return response(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Đã có lỗi xảy ra", Map.of(), request);
        }
        log.error("Unhandled exception traceId={} method={} path={} exception={} message={}",
            traceId(), request.getMethod(), request.getRequestURI(), ex.getClass().getSimpleName(),
            safeLogMessage(ex), ex);
        return response(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Đã có lỗi xảy ra", Map.of(), request);
    }

    private static String clientErrorCode(HttpStatus status) {
        return switch (status) {
            case UNAUTHORIZED -> "UNAUTHORIZED";
            case FORBIDDEN -> "FORBIDDEN";
            case NOT_FOUND -> "NOT_FOUND";
            case METHOD_NOT_ALLOWED -> "METHOD_NOT_ALLOWED";
            case NOT_ACCEPTABLE, UNSUPPORTED_MEDIA_TYPE -> "UNSUPPORTED_MEDIA_TYPE";
            case PAYLOAD_TOO_LARGE -> "PAYLOAD_TOO_LARGE";
            default -> "BAD_REQUEST";
        };
    }

    private static String clientErrorMessage(HttpStatus status) {
        return switch (status) {
            case UNAUTHORIZED -> "Bạn cần đăng nhập để tiếp tục";
            case FORBIDDEN -> "Bạn không có quyền thực hiện thao tác này";
            case NOT_FOUND -> "Không tìm thấy tài nguyên";
            case METHOD_NOT_ALLOWED -> "Phương thức không được hỗ trợ";
            case NOT_ACCEPTABLE, UNSUPPORTED_MEDIA_TYPE -> "Định dạng dữ liệu không được hỗ trợ";
            case PAYLOAD_TOO_LARGE -> "File hoặc dữ liệu gửi lên vượt quá dung lượng cho phép";
            default -> "Yêu cầu không hợp lệ";
        };
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
