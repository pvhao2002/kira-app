package com.queue.kiraqueue.config;

import com.queue.kiraqueue.dto.EventHtml;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;

@Configuration
public class AppConfig {
    @Bean
    public BlockingQueue<EventHtml> eventQueue() {
        return new LinkedBlockingQueue<>(1_000_000);
    }
}
