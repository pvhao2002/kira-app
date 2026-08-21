package com.kira.bank.lodging.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
@EnableConfigurationProperties(MapboxProperties.class)
public class MapboxConfiguration {
    @Bean RestClient mapboxRestClient(MapboxProperties properties) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(properties.connectTimeout() == null ? java.time.Duration.ofSeconds(5) : properties.connectTimeout());
        factory.setReadTimeout(properties.readTimeout() == null ? java.time.Duration.ofSeconds(15) : properties.readTimeout());
        return RestClient.builder().requestFactory(factory).build();
    }
}
