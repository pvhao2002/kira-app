package com.matchmind.security;

import com.matchmind.security.AuthService.ChangePasswordRequest;
import com.matchmind.security.AuthService.CreateUserRequest;
import com.matchmind.security.AuthService.GeneratedPassword;
import com.matchmind.security.AuthService.LoginRequest;
import com.matchmind.security.AuthService.LoginResponse;
import com.matchmind.security.AuthService.ResetPasswordRequest;
import com.matchmind.security.AuthService.UpdateUserRequest;
import com.matchmind.security.AuthService.UserView;
import com.matchmind.security.Principals.UserPrincipal;
import com.matchmind.shared.ApiTypes.PageResponse;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "Authentication & users")
public class AuthController {
    private final AuthService auth;
    private final UserAudit audit;
    private final ClientIpResolver ips;

    @PostMapping("/auth/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest r, HttpServletRequest request) {
        return auth.login(r, ips.resolve(request));
    }

    /** Ends this session only. */
    @PostMapping("/auth/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@AuthenticationPrincipal UserPrincipal me) {
        auth.logout(me);
    }

    /** Ends every session of the user, on every device. */
    @PostMapping("/auth/logout-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logoutAll(@AuthenticationPrincipal UserPrincipal me) {
        auth.logoutEverywhere(me.id());
    }

    /** Sliding renewal: a new token for the signed-in user, capped by the maximum session length. */
    @PostMapping("/auth/refresh")
    public LoginResponse refresh(@AuthenticationPrincipal UserPrincipal me) {
        return auth.refresh(me);
    }

    @GetMapping("/auth/me")
    public UserView me(@AuthenticationPrincipal UserPrincipal me) {
        return auth.me(me.id());
    }

    @PostMapping("/auth/change-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@AuthenticationPrincipal UserPrincipal me, @Valid @RequestBody ChangePasswordRequest r,
                               HttpServletRequest request) {
        auth.changePassword(me, r, ips.resolve(request));
    }

    @GetMapping("/users")
    public List<UserView> users() {
        return auth.list();
    }

    @PostMapping("/users")
    @ResponseStatus(HttpStatus.CREATED)
    public UserView create(@AuthenticationPrincipal UserPrincipal me, @Valid @RequestBody CreateUserRequest r,
                           HttpServletRequest request) {
        return auth.create(me, r, ips.resolve(request));
    }

    /** A random password that passes the policy, for the admin to hand over. Nothing is stored. */
    @PostMapping("/users/generate-password")
    public GeneratedPassword generatePassword() {
        return new GeneratedPassword(PasswordPolicy.generate());
    }

    @GetMapping("/users/audit")
    public PageResponse<Map<String, Object>> auditTrail(@RequestParam(required = false) UUID userId,
                                                        @RequestParam(required = false) Integer page,
                                                        @RequestParam(required = false) Integer size) {
        return audit.list(userId, page, size);
    }

    @PatchMapping("/users/{id}")
    public UserView update(@AuthenticationPrincipal UserPrincipal me, @PathVariable UUID id,
                           @Valid @RequestBody UpdateUserRequest r, HttpServletRequest request) {
        return auth.update(me, id, r, ips.resolve(request));
    }

    @PostMapping("/users/{id}/reset-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetPassword(@AuthenticationPrincipal UserPrincipal me, @PathVariable UUID id,
                              @Valid @RequestBody ResetPasswordRequest r, HttpServletRequest request) {
        auth.resetPassword(me, id, r, ips.resolve(request));
    }

    /** Clears the failed-login lockout of a user. */
    @PostMapping("/users/{id}/unlock")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unlock(@AuthenticationPrincipal UserPrincipal me, @PathVariable UUID id, HttpServletRequest request) {
        auth.unlock(me, id, ips.resolve(request));
    }
}
