package com.kira.bank.creditcard.config;

import com.kira.bank.creditcard.application.CardStatementImportRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Configuration
public class CardStatementImportConfiguration {
    @Bean(name = "cardStatementAiRunExecutor", destroyMethod = "shutdown")
    ExecutorService cardStatementAiRunExecutor() {
        return Executors.newFixedThreadPool(
            CardStatementImportRunner.MAX_CONCURRENT_RUNS,
            Thread.ofPlatform().name("card-statement-ai-run-", 0).factory()
        );
    }
}
