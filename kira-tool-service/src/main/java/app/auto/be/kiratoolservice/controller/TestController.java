package app.auto.be.kiratoolservice.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.boot.web.server.servlet.context.ServletWebServerApplicationContext;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@Log
@RestController
@RequiredArgsConstructor
public class TestController {
    private final ServletWebServerApplicationContext webServerAppCtxt;
    @GetMapping
    public String test() {
        var currentPort = webServerAppCtxt.getWebServer().getPort();
        log.info("Current port: " + currentPort);
        // random log with 100 rows
        for (int i = 0; i < 100; i++) {
            log.info("Log row " + i);
        }
        return "Kira Tool Service is running on port %s.".formatted(currentPort);
    }
}
