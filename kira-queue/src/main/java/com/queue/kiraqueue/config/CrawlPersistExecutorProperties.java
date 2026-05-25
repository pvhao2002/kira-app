package com.queue.kiraqueue.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "kira.queue.crawl-persist")
public class CrawlPersistExecutorProperties {

    private Integer corePoolSize = 2;
    private Integer maxPoolSize = 4;
    private Integer queueCapacity = 50;
    private String threadNamePrefix = "crawl-persist-";
    private Integer awaitTerminationSeconds = 30;

    public int getCorePoolSize() {
        return corePoolSize != null ? corePoolSize : 2;
    }

    public void setCorePoolSize(Integer corePoolSize) {
        this.corePoolSize = corePoolSize;
    }

    public int getMaxPoolSize() {
        return maxPoolSize != null ? maxPoolSize : 4;
    }

    public void setMaxPoolSize(Integer maxPoolSize) {
        this.maxPoolSize = maxPoolSize;
    }

    public int getQueueCapacity() {
        return queueCapacity != null ? queueCapacity : 50;
    }

    public void setQueueCapacity(Integer queueCapacity) {
        this.queueCapacity = queueCapacity;
    }

    public String getThreadNamePrefix() {
        return threadNamePrefix != null && !threadNamePrefix.isBlank()
                ? threadNamePrefix
                : "crawl-persist-";
    }

    public void setThreadNamePrefix(String threadNamePrefix) {
        this.threadNamePrefix = threadNamePrefix;
    }

    public int getAwaitTerminationSeconds() {
        return awaitTerminationSeconds != null ? awaitTerminationSeconds : 30;
    }

    public void setAwaitTerminationSeconds(Integer awaitTerminationSeconds) {
        this.awaitTerminationSeconds = awaitTerminationSeconds;
    }
}
