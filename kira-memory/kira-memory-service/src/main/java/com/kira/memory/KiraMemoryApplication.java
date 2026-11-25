package com.kira.memory;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class KiraMemoryApplication {
    public static void main(String[] args) {
        SpringApplication.run(KiraMemoryApplication.class, args);
    }
}
