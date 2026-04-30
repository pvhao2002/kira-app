package kira.schema.service;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class SchemaRunner implements ApplicationRunner {

    private final SchemaSyncService schemaSyncService;
    private final ConfigurableApplicationContext applicationContext;

    public SchemaRunner(SchemaSyncService schemaSyncService,
                        ConfigurableApplicationContext applicationContext) {
        this.schemaSyncService = schemaSyncService;
        this.applicationContext = applicationContext;
    }

    @Override
    public void run(ApplicationArguments args) {
        SchemaSyncResult result = schemaSyncService.run();
        int code = SpringApplication.exit(applicationContext, () -> result.exitCode());
        System.exit(code);
    }
}
