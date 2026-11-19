package com.matchmind.shared;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {
    @Bean
    OpenAPI matchMindOpenApi() {
        return new OpenAPI()
            .info(new Info().title("MatchMind API").version("v1").description("AI Football Intelligence Platform"))
            .components(new Components()
                .addSecuritySchemes("bearer", new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT"))
                .addSecuritySchemes("apiKey", new SecurityScheme().type(SecurityScheme.Type.APIKEY)
                    .in(SecurityScheme.In.HEADER).name("X-Api-Key")))
            .addSecurityItem(new SecurityRequirement().addList("bearer"));
    }
}
