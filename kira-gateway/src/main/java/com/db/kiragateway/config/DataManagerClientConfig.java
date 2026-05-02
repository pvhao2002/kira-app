package com.db.kiragateway.config;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class DataManagerClientConfig {

    @Bean
    @Qualifier("dataManagerRestClient")
    RestClient dataManagerRestClient(DataManagerProperties props) {
        return RestClient.builder().baseUrl(props.getBaseUrl()).build();
    }
}
