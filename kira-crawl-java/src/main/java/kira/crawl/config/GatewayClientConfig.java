package kira.crawl.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;
import kira.crawl.util.ApiRequestUtils;

@Configuration
@ConditionalOnProperty(name = "app.odds-crawl-job.enabled", havingValue = "true")
public class GatewayClientConfig {

    @Bean
    RestClient gatewayRestClient(
            GatewayProperties gatewayProperties,
            @Value("${app.odds-crawl-job.read-timeout-ms:30000}") int readTimeoutMs
    ) {
        return ApiRequestUtils.buildRestClient(
                gatewayProperties.baseUrl(),
                ApiRequestUtils.DEFAULT_CONNECT_TIMEOUT_MS,
                readTimeoutMs
        );
    }
}
