package com.db.kiragateway.config.security;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

@Getter
@Setter
@ConfigurationProperties(prefix = "app.security")
public class AppSecurityProperties {

    private Jwt jwt = new Jwt();
    private Cookie cookie = new Cookie();
    private Cors cors = new Cors();

    @Setter
    @Getter
    public static class Jwt {
        private String secret;
        private String issuer;
        private long accessTokenTtlSeconds = 900;

    }

    @Setter
    @Getter
    public static class Cookie {
        private String name = "access_token";
        private boolean secure = true;
        private String sameSite = "Strict";
        private String domain = "";
        private String path = "/gateway";
        private long maxAgeSeconds = 900;
    }

    @Setter
    @Getter
    public static class Cors {
        private List<String> allowedOrigins = List.of("*");
    }
}
