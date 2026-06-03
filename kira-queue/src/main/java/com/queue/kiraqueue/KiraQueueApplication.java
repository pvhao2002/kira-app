package com.queue.kiraqueue;

import com.queue.kiraqueue.config.PlaywrightProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableConfigurationProperties({PlaywrightProperties.class})
public class KiraQueueApplication {

    public static void main(String[] args) {
        SpringApplication.run(KiraQueueApplication.class, args);
    }

}
