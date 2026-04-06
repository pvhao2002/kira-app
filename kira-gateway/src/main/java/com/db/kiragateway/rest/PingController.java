package com.db.kiragateway.rest;

import java.util.Map;

import org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController("ping")
public class PingController {

    private final ServletWebServerApplicationContext webServerAppCtxt;

    public PingController(ServletWebServerApplicationContext webServerAppCtxt) {
        this.webServerAppCtxt = webServerAppCtxt;
    }

    @GetMapping
    public Object ping() {
        var port = webServerAppCtxt.getWebServer().getPort();
        return Map.of("message", "Kira Gateway is running on port %s.".formatted(port), "status", "ok");
    }
}
