package kira.crawl.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
@ConditionalOnProperty(name = "app.odds-crawl-job.enabled", havingValue = "true")
public class GatewayClientConfig {

    @Bean
    RestClient gatewayRestClient(
            GatewayProperties gatewayProperties,
            @Value("${app.odds-crawl-job.read-timeout-ms:30000}") int readTimeoutMs
    ) {
        var requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(10_000);
        requestFactory.setReadTimeout(readTimeoutMs);

        return RestClient.builder()
                .baseUrl(gatewayProperties.baseUrl())
                .requestFactory(requestFactory)
                .build();
    }
}
