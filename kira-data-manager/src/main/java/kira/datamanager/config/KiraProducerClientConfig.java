package kira.datamanager.config;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
@EnableConfigurationProperties(KiraProducerProperties.class)
public class KiraProducerClientConfig {

    @Bean
    @Qualifier("kiraProducerRestClient")
    RestClient kiraProducerRestClient(KiraProducerProperties props) {
        return RestClient.builder().baseUrl(trimTrailingSlash(props.getBaseUrl())).build();
    }

    private static String trimTrailingSlash(String url) {
        if (url == null || url.isEmpty()) {
            return url;
        }
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
