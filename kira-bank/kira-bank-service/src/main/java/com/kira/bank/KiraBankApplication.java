package com.kira.bank;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class KiraBankApplication {
    static void main(String[] args) {
        SpringApplication.run(KiraBankApplication.class, args);
    }
}
