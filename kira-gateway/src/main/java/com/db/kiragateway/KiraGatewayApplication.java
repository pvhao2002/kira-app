package com.db.kiragateway;

import com.db.kiragateway.config.export.KiraCrawlExportProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(KiraCrawlExportProperties.class)
public class KiraGatewayApplication {

    public static void main(String[] args) {
        SpringApplication.run(KiraGatewayApplication.class, args);
    }

}
