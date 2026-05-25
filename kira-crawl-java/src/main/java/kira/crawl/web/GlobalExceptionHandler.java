package kira.crawl.web;

import kira.crawl.browser.BrowserPoolExhaustedException;
import kira.crawl.service.AiscoreBadGatewayException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MissingServletRequestParameterException.class)
    ResponseEntity<ErrorResponse> handleMissingParam(MissingServletRequestParameterException ex) {
        log.warn("Bad request: missing parameter {}", ex.getParameterName());
        return badRequest(ex.getParameterName() + " query parameter is required");
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex) {
        log.warn("Bad request: {}", ex.getMessage());
        return badRequest(ex.getMessage());
    }

    @ExceptionHandler(AiscoreBadGatewayException.class)
    ResponseEntity<ErrorResponse> handleBadGateway(AiscoreBadGatewayException ex) {
        log.warn("AiScore bad gateway: {}", ex.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(new ErrorResponse(ex.getMessage(), ex.getDetails()));
    }

    @ExceptionHandler(BrowserPoolExhaustedException.class)
    ResponseEntity<ErrorResponse> handlePoolExhausted(BrowserPoolExhaustedException ex) {
        log.warn("Browser pool exhausted: apiType={}", ex.getApiType());
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(new ErrorResponse(ex.getMessage(), Map.of("apiType", ex.getApiType().name())));
    }

    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<ErrorResponse> handleResponseStatus(ResponseStatusException ex) {
        var message = ex.getReason() != null ? ex.getReason() : ex.getMessage();
        log.warn("Request failed: status={} message={}", ex.getStatusCode().value(), message);
        return ResponseEntity.status(ex.getStatusCode())
                .body(new ErrorResponse(message, Map.of()));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<ErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        log.warn("Bad request: invalid parameter {}", ex.getName());
        return badRequest("Invalid parameter: " + ex.getName());
    }

    private ResponseEntity<ErrorResponse> badRequest(String message) {
        return ResponseEntity.badRequest().body(new ErrorResponse(message, Map.of()));
    }
}
