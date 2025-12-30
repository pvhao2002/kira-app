package com.app.kira.config;


import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class LoginResponse {
    String token;
    String email;
    List<String> roles;
    long expiredDate;
}
