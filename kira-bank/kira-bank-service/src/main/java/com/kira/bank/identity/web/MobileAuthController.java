package com.kira.bank.identity.web;

import com.kira.bank.identity.application.AuthDtos.LoginRequest;
import com.kira.bank.identity.application.AuthDtos.ProfileResponse;
import com.kira.bank.identity.application.AuthService;
import com.kira.bank.shared.infrastructure.ClientIpResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth/mobile")
@RequiredArgsConstructor
public class MobileAuthController {
    private final AuthService auth;
    private final ClientIpResolver clientIps;

    private MobileSession response(AuthService.Session s) {
        return new MobileSession(s.response().accessToken(), s.response().expiresInSeconds(), s.response().user(), s.refreshToken());
    }

    @PostMapping("/login")
    public MobileSession login(@Valid @RequestBody LoginRequest r, HttpServletRequest request) {
        return response(auth.login(r, clientIps.resolve(request).ip()));
    }

    @PostMapping("/refresh")
    public MobileSession refresh(@Valid @RequestBody Refresh r) {
        return response(auth.rotate(r.refreshToken()));
    }

    @PostMapping("/logout")
    public void logout(@Valid @RequestBody Refresh r) {
        auth.logout(r.refreshToken());
    }

    public record Refresh(@NotBlank @Size(max = 200) String refreshToken) {
    }

    public record MobileSession(String accessToken, long expiresInSeconds, ProfileResponse user, String refreshToken) {
    }
}
