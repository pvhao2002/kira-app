package kira.crawl.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    OpenAPI openApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("Kira Crawl Java API")
                        .description("AiScore crawl service using Playwright and protobuf decoding")
                        .version("1.0.0"));
    }
}
