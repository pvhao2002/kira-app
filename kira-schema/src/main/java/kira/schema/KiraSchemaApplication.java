package kira.schema;

import kira.schema.config.SchemaProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(SchemaProperties.class)
public class KiraSchemaApplication {

    public static void main(String[] args) {
        SpringApplication.run(KiraSchemaApplication.class, args);
    }
}
