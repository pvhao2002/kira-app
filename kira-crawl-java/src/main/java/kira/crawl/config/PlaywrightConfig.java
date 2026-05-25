package kira.crawl.config;

import jakarta.annotation.PostConstruct;
import kira.crawl.util.PlaywrightUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;

@Configuration
@RequiredArgsConstructor
public class PlaywrightConfig {

    private final PlaywrightProperties properties;

    @PostConstruct
    void bindPlaywrightRuntime() {
        PlaywrightUtil.bindFromProperties(properties);
    }
}
