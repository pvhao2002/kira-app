package kira.crawl.config;

import jakarta.annotation.PostConstruct;
import kira.crawl.browser.PlaywrightCrawlLanes;
import kira.crawl.util.PlaywrightUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@RequiredArgsConstructor
public class PlaywrightConfig {

    private final PlaywrightProperties properties;

    @Bean
    PlaywrightCrawlLanes playwrightCrawlLanes() {
        return new PlaywrightCrawlLanes(properties);
    }

    @PostConstruct
    void bindPlaywrightRuntime() {
        PlaywrightUtil.bindFromProperties(properties);
    }
}
