package com.queue.kiraqueue.rest;

import com.queue.kiraqueue.config.BusinessException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class RestExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<Map<String, Object>> handleBusinessException(BusinessException ex) {
        return ResponseEntity.status(ex.getStatus()).body(Map.of(
                "error", ex.getStatus().getReasonPhrase(),
                "message", ex.getMessage()
        ));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleException(Exception ex) {
        return ResponseEntity.internalServerError().body(Map.of(
                "error", "Internal Server Error",
                "message", ex.getMessage() == null ? "Unexpected error" : ex.getMessage()
        ));
    }
}
