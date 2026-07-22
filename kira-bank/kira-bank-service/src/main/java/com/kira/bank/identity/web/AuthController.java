package com.kira.bank.identity.web;

import com.kira.bank.identity.application.AuthService;
import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.time.Duration;
import static com.kira.bank.identity.application.AuthDtos.*;

@RestController @RequestMapping("/api/v1/auth") @RequiredArgsConstructor
public class AuthController {
    private static final String COOKIE="kira_refresh"; private final AuthService auth;
    @Value("${app.refresh-cookie-secure:false}") private boolean secureCookie;
    @PostMapping("/register") public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest r){return session(auth.register(r));}
    @PostMapping("/login") public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest r){return session(auth.login(r));}
    @PostMapping("/refresh") public ResponseEntity<AuthResponse> refresh(@CookieValue(COOKIE) String token){return session(auth.rotate(token));}
    @PostMapping("/logout") public ResponseEntity<Void> logout(@CookieValue(value=COOKIE,required=false) String token){auth.logout(token);return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE,clearCookie().toString()).build();}
    @GetMapping("/profile") public ProfileResponse profile(@AuthenticationPrincipal Long id){return auth.profile(id);}
    @PutMapping("/profile") public ProfileResponse update(@AuthenticationPrincipal Long id,@Valid @RequestBody UpdateProfileRequest r){return auth.update(id,r);}
    @PostMapping("/change-password") @ResponseStatus(HttpStatus.NO_CONTENT) public void change(@AuthenticationPrincipal Long id,@Valid @RequestBody ChangePasswordRequest r){auth.changePassword(id,r);}
    private ResponseEntity<AuthResponse> session(AuthService.Session s){return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE,cookie(s.refreshToken()).toString()).body(s.response());}
    private ResponseCookie cookie(String value){return ResponseCookie.from(COOKIE,value).httpOnly(true).secure(secureCookie).sameSite("Strict").path("/api/v1/auth").maxAge(Duration.ofDays(30)).build();}
    private ResponseCookie clearCookie(){return ResponseCookie.from(COOKIE,"").httpOnly(true).secure(secureCookie).sameSite("Strict").path("/api/v1/auth").maxAge(Duration.ZERO).build();}
}
