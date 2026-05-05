package com.db.kiragateway;

import com.db.kiragateway.config.DataManagerProperties;
import com.db.kiragateway.config.GeminiProperties;
import com.db.kiragateway.config.KiraProducerProperties;
import com.db.kiragateway.config.export.KiraCrawlExportProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties({
        KiraCrawlExportProperties.class,
        DataManagerProperties.class,
        KiraProducerProperties.class,
        GeminiProperties.class
})
public class KiraGatewayApplication {

    public static void main(String[] args) {
        SpringApplication.run(KiraGatewayApplication.class, args);
    }

}
