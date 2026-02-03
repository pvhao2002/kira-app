package app.auto.be.kiratoolservice.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.web.server.servlet.context.ServletWebServerApplicationContext;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class TestController {
    private final ServletWebServerApplicationContext webServerAppCtxt;
    @GetMapping
    public String test() {
        var currentPort = webServerAppCtxt.getWebServer().getPort();
        return "Kira Tool Service is running on port %s.".formatted(currentPort);
    }
}
