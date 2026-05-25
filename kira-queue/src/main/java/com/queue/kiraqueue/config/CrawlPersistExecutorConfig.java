package com.queue.kiraqueue.config;

import jakarta.annotation.PreDestroy;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

@Configuration
@EnableConfigurationProperties(CrawlPersistExecutorProperties.class)
public class CrawlPersistExecutorConfig {

    public static final String CRAWL_PERSIST_EXECUTOR = "crawlPersistExecutor";

    private ThreadPoolTaskExecutor executor;

    @Bean(name = CRAWL_PERSIST_EXECUTOR)
    public Executor crawlPersistExecutor(CrawlPersistExecutorProperties properties) {
        var taskExecutor = new ThreadPoolTaskExecutor();
        taskExecutor.setCorePoolSize(properties.getCorePoolSize());
        taskExecutor.setMaxPoolSize(properties.getMaxPoolSize());
        taskExecutor.setQueueCapacity(properties.getQueueCapacity());
        taskExecutor.setThreadNamePrefix(properties.getThreadNamePrefix());
        taskExecutor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        taskExecutor.setWaitForTasksToCompleteOnShutdown(true);
        taskExecutor.setAwaitTerminationSeconds(properties.getAwaitTerminationSeconds());
        taskExecutor.initialize();
        this.executor = taskExecutor;
        return taskExecutor;
    }

    @PreDestroy
    public void shutdown() {
        if (executor != null) {
            executor.shutdown();
        }
    }
}
