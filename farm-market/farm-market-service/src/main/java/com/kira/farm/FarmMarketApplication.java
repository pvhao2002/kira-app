package com.kira.farm;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class FarmMarketApplication {
    public static void main(String[] args) {
        SpringApplication.run(FarmMarketApplication.class, args);
    }
}
