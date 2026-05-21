package kira.crawl.config;

import io.micrometer.core.instrument.MeterRegistry;
import kira.crawl.browser.PlaywrightBrowserPool;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class PlaywrightConfig {

    @Bean(destroyMethod = "close")
    PlaywrightBrowserPool playwrightBrowserPool(
            PlaywrightProperties properties,
            ObjectProvider<MeterRegistry> meterRegistry
    ) {
        return new PlaywrightBrowserPool(properties, meterRegistry.getIfAvailable());
    }
}
