package com.kira.affiliate.shopee.infrastructure;

import com.kira.affiliate.shared.web.ApiException;
import lombok.Getter;
import org.springframework.http.HttpStatus;

/** A failure reported by (or while reaching) the Shopee Affiliate Open API. {@code code} 0 = transport failure. */
@Getter
public class ShopeeApiException extends RuntimeException {
    public enum Kind {INVALID_CREDENTIAL, NO_API_ACCESS, RATE_LIMITED, ERROR}

    private final int code;
    private final Kind kind;

    public ShopeeApiException(int code, String message) {
        super(message);
        this.code = code;
        this.kind = kindOf(code);
    }

    static Kind kindOf(int code) {
        if (code == 10020) return Kind.INVALID_CREDENTIAL;
        if (code == 10030) return Kind.RATE_LIMITED;
        if (code >= 10031 && code <= 10035) return Kind.NO_API_ACCESS;
        return Kind.ERROR;
    }

    public String userMessage() {
        return switch (kind) {
            case INVALID_CREDENTIAL -> "Shopee từ chối AppID/Secret (mã 10020). Kiểm tra lại thông tin API.";
            case NO_API_ACCESS -> "Tài khoản Shopee Affiliate chưa có quyền dùng Open API hoặc đang bị hạn chế (mã " + code + ").";
            case RATE_LIMITED -> "Đã vượt giới hạn số lần gọi Shopee API (mã 10030). Thử lại sau.";
            case ERROR -> code == 0 ? "Không kết nối được tới Shopee API. Thử lại sau."
                : "Shopee API trả về lỗi (mã " + code + ").";
        };
    }

    public ApiException toApi() {
        HttpStatus status = kind == Kind.RATE_LIMITED ? HttpStatus.TOO_MANY_REQUESTS : HttpStatus.BAD_GATEWAY;
        return new ApiException(status, "SHOPEE_" + kind.name(), userMessage());
    }
}
