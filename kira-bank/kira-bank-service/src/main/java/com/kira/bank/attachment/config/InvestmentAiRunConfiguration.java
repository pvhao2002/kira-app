package com.kira.bank.attachment.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Configuration
public class InvestmentAiRunConfiguration {
    public static final int MAX_CONCURRENT_RUNS = 3;

    @Bean(name = "investmentAiRunExecutor", destroyMethod = "shutdown")
    ExecutorService investmentAiRunExecutor() {
        return Executors.newFixedThreadPool(
            MAX_CONCURRENT_RUNS,
            Thread.ofPlatform().name("investment-ai-run-", 0).factory()
        );
    }
}
