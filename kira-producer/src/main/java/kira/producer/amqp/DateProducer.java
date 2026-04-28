package kira.producer.amqp;

import kira.producer.config.RabbitMQConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

@Log
@Service
@RequiredArgsConstructor
public class DateProducer {
    private final RabbitTemplate rabbitTemplate;

    public void sendDate(String date) {
        log.info("kira-producer >> Sending date for event crawling: " + date);
        rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE, RabbitMQConfig.ROUTING_KEY_DATE, date);
    }

    public void sendDateTomorrow(String date) {
        log.info("kira-producer >> Sending date for tomorrow event crawling: " + date);
        rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE, RabbitMQConfig.ROUTING_KEY_DATE_TOMORROW, date);
    }
}
