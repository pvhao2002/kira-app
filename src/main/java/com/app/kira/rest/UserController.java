package com.app.kira.rest;

import com.app.kira.config.JwtTokenProvider;
import com.app.kira.config.UserAccount;
import com.app.kira.dto.UserDTO;
import com.app.kira.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("user")
@RequiredArgsConstructor
public class UserController {
    private final PasswordEncoder passwordEncoder;
    private final UserService userService;
    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider jwtUtilities;

    @GetMapping("info")
    public Object info(@AuthenticationPrincipal UserAccount userDTO) {
        return Map.of("username", userDTO.getUsername(), "role", userDTO.getRole());
    }

    @PostMapping("sign-up")
    public Object signUp(@RequestBody UserDTO request) {
        userService.signUp(request.getUsername(), passwordEncoder.encode(request.getPassword()));
        return "User registered successfully";
    }

    @PostMapping("sign-in")
    public Object signIn(@RequestBody UserDTO request) {
        var v1 = new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword());
        var authentication = authenticationManager.authenticate(v1);
        SecurityContextHolder
                .getContext()
                .setAuthentication(authentication);
        var user = userService.findByUsername(request.getUsername());
        if (user == null || List.of("inactive", "block").contains(user.getStatus())) {
            return Map.of(
                    "status", false,
                    "message", "Please contact kira to activate your account"
            );
        }
        return Map.of(
                "status", true,
                "data", jwtUtilities.generateTokenV2(user.getUsername(), List.of(user.getRole()))
        );
    }
}
