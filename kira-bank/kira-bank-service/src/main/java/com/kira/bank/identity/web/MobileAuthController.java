package com.kira.bank.identity.web;

import com.kira.bank.identity.application.AuthService;
import com.kira.bank.identity.application.AuthDtos.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth/mobile")
@RequiredArgsConstructor
public class MobileAuthController {
    private final AuthService auth;
    public record Refresh(@NotBlank @Size(max=200) String refreshToken) {}
    public record MobileSession(String accessToken,long expiresInSeconds,ProfileResponse user,String refreshToken) {}
    private MobileSession response(AuthService.Session s) { return new MobileSession(s.response().accessToken(),s.response().expiresInSeconds(),s.response().user(),s.refreshToken()); }
    @PostMapping("/login") public MobileSession login(@Valid @RequestBody LoginRequest r) { return response(auth.login(r)); }
    @PostMapping("/refresh") public MobileSession refresh(@Valid @RequestBody Refresh r) { return response(auth.rotate(r.refreshToken())); }
    @PostMapping("/logout") public void logout(@Valid @RequestBody Refresh r) { auth.logout(r.refreshToken()); }
}
