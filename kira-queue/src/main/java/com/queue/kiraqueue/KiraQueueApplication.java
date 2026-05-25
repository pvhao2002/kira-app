package com.queue.kiraqueue;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class KiraQueueApplication {

    public static void main(String[] args) {
        SpringApplication.run(KiraQueueApplication.class, args);
    }

}
