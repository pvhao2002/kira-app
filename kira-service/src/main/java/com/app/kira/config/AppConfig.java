package com.app.kira.config;

import com.app.kira.util.PlaywrightUtil;
import org.apache.hc.client5.http.classic.HttpClient;
import org.apache.hc.client5.http.cookie.BasicCookieStore;
import org.apache.hc.client5.http.cookie.CookieStore;
import org.apache.hc.client5.http.impl.classic.HttpClientBuilder;
import org.apache.hc.core5.http.Header;
import org.apache.hc.core5.http.message.BasicHeader;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.util.Arrays;
import java.util.List;

@Configuration
public class AppConfig {

    @Bean
    public RestTemplate restTemplate() {
        CookieStore cookieStore = new BasicCookieStore();
        List<Header> defaultHeaders = Arrays.asList(
                new BasicHeader("accept", "*/*"),
                new BasicHeader("accept-language", "en-US,en;q=0.5"),
                new BasicHeader("cache-control", "no-cache"),
                new BasicHeader("pragma", "no-cache"),
                new BasicHeader("user-agent", PlaywrightUtil.USER_AGENT)
        );
        HttpClient httpClient = HttpClientBuilder.create()
                .setDefaultCookieStore(cookieStore)
                .setDefaultHeaders(defaultHeaders)
                .build();
        HttpComponentsClientHttpRequestFactory factory =
                new HttpComponentsClientHttpRequestFactory(httpClient);
        return new RestTemplate(factory);
    }

}

