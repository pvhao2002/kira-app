package com.kira.bank.ai;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
@EnableConfigurationProperties({AiProviderConfiguration.class, AiJobProperties.class})
public class AiConfiguration {
    @Bean
    RestClient cloudflareAiRestClient(AiProviderConfiguration properties) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(properties.connectTimeout());
        requestFactory.setReadTimeout(properties.readTimeout());
        String baseUrl = properties.baseUrl();
        if (baseUrl == null || baseUrl.isBlank()) {
            baseUrl = "https://api.cloudflare.com/client/v4/accounts";
        }
        return RestClient.builder().requestFactory(requestFactory).baseUrl(baseUrl).build();
    }
}
