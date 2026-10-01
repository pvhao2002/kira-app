package com.kira.farm.shared.security;

import com.kira.farm.shared.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

/** Static accessor for the authenticated principal; use in application services instead of trusting request ids. */
public final class CurrentUser {
    private CurrentUser() {
    }

    public static Optional<AuthPrincipal> find() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getPrincipal() instanceof AuthPrincipal p ? Optional.of(p) : Optional.empty();
    }

    public static AuthPrincipal require() {
        return find().orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED",
            "Bạn cần đăng nhập để tiếp tục"));
    }

    public static Long id() {
        return require().userId();
    }
}
