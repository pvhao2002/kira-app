package com.queue.kiraqueue;

import com.queue.kiraqueue.config.PlaywrightProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties({PlaywrightProperties.class})
public class KiraQueueApplication {

    public static void main(String[] args) {
        SpringApplication.run(KiraQueueApplication.class, args);
    }

}
