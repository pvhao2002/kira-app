package kira.crawl;

import kira.crawl.config.PlaywrightProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(PlaywrightProperties.class)
public class KiraCrawlApplication {

    public static void main(String[] args) {
        SpringApplication.run(KiraCrawlApplication.class, args);
    }
}
