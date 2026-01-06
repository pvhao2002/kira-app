package app.auto.be.kiratoolservice.controller;

import app.auto.be.kiratoolservice.util.PlaywrightUtil;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController("scribd")
public class ScribdController {
    @PostMapping
    public Object getScribd(@RequestBody ScribdRequest request) {
        PlaywrightUtil.withPlaywright(request, (page, req) -> {
            page.navigate(req.url());
            PlaywrightUtil.waitDomContentLoaded(page);
            page.waitForTimeout(20000);
        });
        return Map.of();
    }

    public record ScribdRequest(String url) {
    }
}
