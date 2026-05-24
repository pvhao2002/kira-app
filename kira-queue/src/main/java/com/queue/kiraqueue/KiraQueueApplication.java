package com.queue.kiraqueue;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

import com.queue.kiraqueue.config.R2Properties;

@SpringBootApplication
@EnableScheduling
@EnableConfigurationProperties(R2Properties.class)
public class KiraQueueApplication {

    public static void main(String[] args) {
        SpringApplication.run(KiraQueueApplication.class, args);
    }

}
