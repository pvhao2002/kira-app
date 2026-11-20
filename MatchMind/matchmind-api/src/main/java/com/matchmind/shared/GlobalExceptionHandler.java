package com.matchmind.shared;

import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.exc.InvalidFormatException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.TypeMismatchException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

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
        Map<String, String> fields = new LinkedHashMap<>();
        ex.getFieldErrors().forEach((field, message) -> fields.put(field, readable(field, message)));
        return ResponseEntity.status(ex.getStatus()).headers(ex.getHeaders())
            .body(error(ex.getStatus(), ex.getCode(), ex.getMessage(), fields, request));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ErrorResponse> validation(MethodArgumentNotValidException ex, HttpServletRequest request) {
        Map<String, String> fields = new LinkedHashMap<>();
        for (FieldError e : ex.getBindingResult().getFieldErrors()) fields.putIfAbsent(e.getField(), fieldMessage(e));
        ex.getBindingResult().getGlobalErrors().forEach(e -> fields.putIfAbsent(e.getObjectName(),
            readable(e.getObjectName(), e.getDefaultMessage())));
        return response(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Request validation failed", fields, request);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ErrorResponse> malformed(HttpMessageNotReadableException ex, HttpServletRequest request) {
        Map<String, String> fields = Map.of();
        if (ex.getCause() instanceof JsonMappingException jm && !jm.getPath().isEmpty()) {
            StringBuilder path = new StringBuilder();
            for (JsonMappingException.Reference ref : jm.getPath()) {
                if (ref.getFieldName() != null) path.append(path.isEmpty() ? "" : ".").append(ref.getFieldName());
                else path.append('[').append(ref.getIndex()).append(']');
            }
            Class<?> target = jm instanceof InvalidFormatException f ? f.getTargetType() : null;
            fields = Map.of(path.toString(), target == null ? "has the wrong type or format"
                : "must be " + describe(target));
        }
        return response(HttpStatus.BAD_REQUEST, "MALFORMED_REQUEST", "Request body is not valid JSON for this endpoint",
            fields, request);
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    ResponseEntity<ErrorResponse> unsupportedMediaType(HttpMediaTypeNotSupportedException ex, HttpServletRequest request) {
        String supported = ex.getSupportedMediaTypes().isEmpty() ? "application/json"
            : ex.getSupportedMediaTypes().stream().map(MediaType::toString).collect(Collectors.joining(", "));
        return response(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "UNSUPPORTED_MEDIA_TYPE",
            "Content-Type must be " + supported + " (send the header 'Content-Type: application/json')", Map.of(), request);
    }

    /** A malformed id in the URL means no such record, not a bad request. */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<ErrorResponse> argumentMismatch(MethodArgumentTypeMismatchException ex, HttpServletRequest request) {
        if (ex.getParameter().hasParameterAnnotation(PathVariable.class)) {
            return response(HttpStatus.NOT_FOUND, "NOT_FOUND", notFoundMessage(request.getRequestURI(), ex.getValue()),
                Map.of(), request);
        }
        String expected = ex.getRequiredType() == null ? "a valid value" : describe(ex.getRequiredType());
        return response(HttpStatus.BAD_REQUEST, "INVALID_PARAMETER", ex.getName() + " must be " + expected,
            Map.of(ex.getName(), "must be " + expected), request);
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
        if (violatesMergeChain(ex)) {
            // A concurrent merge got there first (V24 trigger): same answer as the service-level check. No row data.
            log.warn("model merge chain rejected by the database traceId={} path={}", traceId(), request.getRequestURI());
            return response(HttpStatus.CONFLICT, "MODEL_ALREADY_MERGED",
                "The models changed while merging; reload and try again", Map.of(), request);
        }
        String immutableTable = immutableTable(ex);
        if (immutableTable != null) {
            // A DB trigger (V23) blocked a write to a snapshot or append-only table: a bug. Table name only, no row data.
            log.error("immutable table write blocked: {} traceId={} path={}", immutableTable, traceId(), request.getRequestURI());
            return response(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Unexpected server error", Map.of(), request);
        }
        log.error("Unhandled exception traceId={} path={} exception={}", traceId(), request.getRequestURI(),
            ex.getClass().getSimpleName(), ex);
        return response(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Unexpected server error", Map.of(), request);
    }

    private static final Pattern IMMUTABLE = Pattern.compile("MM_IMMUTABLE: (\\w+)");

    /** The table named by a V23 trigger violation (SQLSTATE P0001) anywhere in the cause chain, else null. */
    private static String immutableTable(Throwable ex) {
        for (Throwable t = ex; t != null; t = t.getCause() == t ? null : t.getCause()) {
            if (t instanceof java.sql.SQLException sql && "P0001".equals(sql.getSQLState()) && sql.getMessage() != null) {
                Matcher m = IMMUTABLE.matcher(sql.getMessage());
                if (m.find()) return m.group(1);
            }
        }
        return null;
    }

    /** A V24 trigger violation (SQLSTATE P0001, MM_MODEL_MERGE_CHAIN) anywhere in the cause chain. */
    private static boolean violatesMergeChain(Throwable ex) {
        for (Throwable t = ex; t != null; t = t.getCause() == t ? null : t.getCause()) {
            if (t instanceof java.sql.SQLException sql && "P0001".equals(sql.getSQLState()) && sql.getMessage() != null
                && sql.getMessage().contains("MM_MODEL_MERGE_CHAIN")) return true;
        }
        return false;
    }

    private static final Pattern SIZE =Pattern.compile("size must be between (\\d+) and (\\d+)");
    private static final String INSTANT_HELP = "an ISO-8601 instant with Z or an offset, e.g. 2026-12-05T20:00:00Z";

    /** One field's message: no Java types or conversion text, only what the caller can act on. */
    private static String fieldMessage(FieldError e) {
        if (e.isBindingFailure()) {
            TypeMismatchException mismatch = e.contains(TypeMismatchException.class) ? e.unwrap(TypeMismatchException.class) : null;
            Class<?> type = mismatch == null ? null : mismatch.getRequiredType();
            return type == null ? "has an invalid value" : "must be " + describe(type);
        }
        return readable(e.getField(), e.getDefaultMessage());
    }

    /** Rewrites generic bean-validation and parser messages into ones that name the limit or the expected format. */
    static String readable(String field, String message) {
        if (message == null) return "is invalid";
        Matcher size = SIZE.matcher(message);
        if (size.matches()) {
            int min = Integer.parseInt(size.group(1));
            int max = Integer.parseInt(size.group(2));
            return min == 0 ? "must be at most " + max + " characters"
                : "must be between " + min + " and " + max + " characters";
        }
        String leaf = field.substring(field.lastIndexOf('.') + 1);
        if ("wrong type or format".equals(message) && (leaf.endsWith("At") || leaf.endsWith("Time"))) {
            return "must be " + INSTANT_HELP;
        }
        return message;
    }

    private static String describe(Class<?> type) {
        if (Instant.class.equals(type)) return INSTANT_HELP;
        if (LocalDate.class.equals(type)) return "a date such as 2026-12-05";
        if (UUID.class.equals(type)) return "a UUID";
        if (Boolean.class.equals(type) || boolean.class.equals(type)) return "true or false";
        if (Number.class.isAssignableFrom(type) || type.isPrimitive()) return "a number";
        if (type.isEnum()) {
            return "one of " + Arrays.stream(type.getEnumConstants()).map(Object::toString).collect(Collectors.joining(", "));
        }
        return "a valid value";
    }

    /** "/api/v1/predictions/not-a-uuid" becomes "Prediction not found". */
    static String notFoundMessage(String uri, Object value) {
        String[] segments = uri.split("/");
        for (int i = 1; i < segments.length; i++) {
            if (segments[i].equals(String.valueOf(value))) {
                String name = segments[i - 1];
                if (name.endsWith("ies")) name = name.substring(0, name.length() - 3) + "y";
                else if (name.endsWith("s")) name = name.substring(0, name.length() - 1);
                if (!name.isEmpty() && name.matches("[a-z-]+")) {
                    String words = name.replace('-', ' ');
                    return Character.toUpperCase(words.charAt(0)) + words.substring(1) + " not found";
                }
            }
        }
        return "Not found";
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
