package com.app.kira.producer;

import com.app.kira.config.RabbitMQConfig;
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
        log.info("Kira Service >> Sending date for event crawling: " + date);
        rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE, RabbitMQConfig.ROUTING_KEY_DATE, date);
    }

    public void sendDateTomorrow(String date) {
        log.info("Kira Service >> Sending date for tomorrow event crawling: " + date);
        rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE, RabbitMQConfig.ROUTING_KEY_DATE_TOMORROW, date);
    }
}
