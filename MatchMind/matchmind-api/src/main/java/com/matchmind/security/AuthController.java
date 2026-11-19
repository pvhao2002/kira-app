package com.matchmind.security;

import com.matchmind.security.AuthService.ChangePasswordRequest;
import com.matchmind.security.AuthService.CreateUserRequest;
import com.matchmind.security.AuthService.LoginRequest;
import com.matchmind.security.AuthService.LoginResponse;
import com.matchmind.security.AuthService.ResetPasswordRequest;
import com.matchmind.security.AuthService.UpdateUserRequest;
import com.matchmind.security.AuthService.UserView;
import com.matchmind.security.Principals.UserPrincipal;
import com.matchmind.shared.ClientIpResolver;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "Authentication & users")
public class AuthController {
    private final AuthService auth;
    private final ClientIpResolver ips;

    @PostMapping("/auth/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest r, HttpServletRequest request) {
        return auth.login(r, ips.resolve(request));
    }

    @PostMapping("/auth/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@AuthenticationPrincipal UserPrincipal me) {
        auth.logout(me.id());
    }

    @GetMapping("/auth/me")
    public UserView me(@AuthenticationPrincipal UserPrincipal me) {
        return auth.me(me.id());
    }

    @PostMapping("/auth/change-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@AuthenticationPrincipal UserPrincipal me, @Valid @RequestBody ChangePasswordRequest r) {
        auth.changePassword(me.id(), r);
    }

    @GetMapping("/users")
    public List<UserView> users() {
        return auth.list();
    }

    @PostMapping("/users")
    @ResponseStatus(HttpStatus.CREATED)
    public UserView create(@Valid @RequestBody CreateUserRequest r) {
        return auth.create(r);
    }

    @PatchMapping("/users/{id}")
    public UserView update(@AuthenticationPrincipal UserPrincipal me, @PathVariable UUID id,
                           @Valid @RequestBody UpdateUserRequest r) {
        return auth.update(me.id(), id, r);
    }

    @PostMapping("/users/{id}/reset-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetPassword(@PathVariable UUID id, @Valid @RequestBody ResetPasswordRequest r) {
        auth.resetPassword(id, r);
    }
}
