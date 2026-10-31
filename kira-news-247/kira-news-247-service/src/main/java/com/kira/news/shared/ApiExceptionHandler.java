package com.kira.news.shared;

import com.kira.news.proto.v1.ApiError;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.UUID;

@RestControllerAdvice
public class ApiExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ApiError> api(ApiException e) {
        return error(e.status(), e.code(), e.getMessage());
    }

    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    ResponseEntity<ApiError> stale() {
        return error(HttpStatus.CONFLICT, "STALE_VERSION", "Bài viết vừa được người khác cập nhật, hãy tải lại trang.");
    }

    /** Client mistakes (bad protobuf bytes, missing/mistyped params) are 400s, not logged server errors. */
    @ExceptionHandler({HttpMessageNotReadableException.class, MissingServletRequestParameterException.class,
            MethodArgumentTypeMismatchException.class})
    ResponseEntity<ApiError> badRequest() {
        return error(HttpStatus.BAD_REQUEST, "BAD_REQUEST", "Yêu cầu không hợp lệ.");
    }

    /** Two concurrent creates racing for the same unique slug. */
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ApiError> duplicate() {
        return error(HttpStatus.CONFLICT, "DUPLICATE", "Dữ liệu bị trùng (ví dụ slug), hãy thử lại.");
    }

    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<ApiError> missing() {
        return error(HttpStatus.NOT_FOUND, "NOT_FOUND", "Không tìm thấy.");
    }

    @ExceptionHandler(HttpMediaTypeException.class)
    ResponseEntity<ApiError> mediaType() {
        return error(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "UNSUPPORTED_MEDIA_TYPE", "API chỉ nhận application/x-protobuf.");
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> unexpected(Exception e) {
        var traceId = UUID.randomUUID().toString();
        log.error("Unhandled error traceId={}", traceId, e);
        return ResponseEntity.internalServerError()
                .contentType(Protobuf.MEDIA_TYPE)
                .body(ApiError.newBuilder().setCode("INTERNAL").setMessage("Đã có lỗi xảy ra.").setTraceId(traceId).build());
    }

    static ResponseEntity<ApiError> error(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status)
                .contentType(Protobuf.MEDIA_TYPE)
                .body(ApiError.newBuilder().setCode(code).setMessage(message).build());
    }
}
