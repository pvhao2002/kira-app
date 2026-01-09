package app.auto.be.kiratoolservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class KiraToolServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(KiraToolServiceApplication.class, args);
    }

}
