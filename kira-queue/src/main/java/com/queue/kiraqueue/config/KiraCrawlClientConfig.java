package com.queue.kiraqueue.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
public class KiraCrawlClientConfig {

    @Bean
    RestClient kiraCrawlRestClient(
            @Value("${app.kira-crawl.base-url}") String baseUrl,
            @Value("${app.kira-crawl.read-timeout-ms:300000}") int readTimeoutMs
    ) {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(readTimeoutMs);
        return RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(factory)
                .build();
    }
}
