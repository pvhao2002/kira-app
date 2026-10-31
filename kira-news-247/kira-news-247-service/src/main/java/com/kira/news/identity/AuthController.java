package com.kira.news.identity;

import com.kira.news.proto.v1.Empty;
import com.kira.news.proto.v1.LoginRequest;
import com.kira.news.proto.v1.Me;
import com.kira.news.shared.ApiException;
import com.kira.news.shared.Protobuf;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(path = "/api/v1/auth", produces = Protobuf.CONTENT_TYPE)
public class AuthController {
    private final AuthenticationManager authenticationManager;
    private final SecurityContextRepository contextRepository;
    private final LoginThrottle throttle;

    public AuthController(AuthenticationManager authenticationManager, SecurityContextRepository contextRepository,
                          LoginThrottle throttle) {
        this.authenticationManager = authenticationManager;
        this.contextRepository = contextRepository;
        this.throttle = throttle;
    }

    @PostMapping(path = "/login", consumes = Protobuf.CONTENT_TYPE)
    public Me login(@RequestBody LoginRequest login, HttpServletRequest request, HttpServletResponse response) {
        var username = login.getUsername().trim();
        if (username.isEmpty() || username.length() > 60 || login.getPassword().length() > 200) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "BAD_CREDENTIALS", "Sai tên đăng nhập hoặc mật khẩu.");
        }
        if (!throttle.tryAcquire(username)) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "LOGIN_LOCKED", "Đăng nhập sai quá nhiều lần, thử lại sau 15 phút.");
        }
        try {
            var auth = authenticationManager.authenticate(
                    UsernamePasswordAuthenticationToken.unauthenticated(username, login.getPassword()));
            throttle.succeeded(username);
            var user = (CurrentUser) auth.getPrincipal();
            // keep the password hash out of the HTTP session
            var principal = new CurrentUser(user.username(), user.displayName(), user.role(), "");
            var sessionAuth = UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities());
            if (request.getSession(false) != null) {
                request.changeSessionId(); // session fixation: never keep a pre-login session id
            }
            var context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(sessionAuth);
            SecurityContextHolder.setContext(context);
            contextRepository.saveContext(context, request, response);
            return toMe(principal);
        } catch (AuthenticationException _) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "BAD_CREDENTIALS", "Sai tên đăng nhập hoặc mật khẩu.");
        }
    }

    @PostMapping("/logout")
    public Empty logout(HttpServletRequest request) {
        var session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
        return Empty.getDefaultInstance();
    }

    /** Anonymous callers get an empty Me (role unspecified) instead of 401, so the UI can probe cheaply. */
    @GetMapping("/me")
    public Me me(@AuthenticationPrincipal CurrentUser user) {
        return user == null ? Me.getDefaultInstance() : toMe(user);
    }

    static Me toMe(CurrentUser user) {
        return Me.newBuilder()
                .setUsername(user.username())
                .setDisplayName(user.displayName())
                .setRole(user.role().toProto())
                .build();
    }
}
