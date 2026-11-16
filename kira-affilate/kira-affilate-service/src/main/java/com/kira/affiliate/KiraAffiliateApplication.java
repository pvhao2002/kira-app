package com.kira.affiliate;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class KiraAffiliateApplication {
    static void main(String[] args) {
        SpringApplication.run(KiraAffiliateApplication.class, args);
    }
}
