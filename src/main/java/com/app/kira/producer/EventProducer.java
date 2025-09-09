package com.app.kira.producer;

import com.app.kira.config.RabbitMQConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

@Log
@Service
@RequiredArgsConstructor
public class EventProducer {
    private final RabbitTemplate rabbitTemplate;

    public void sendEventAnalyst(String eventId) {
        log.info("EventProducer >> sendEventAnalyst >> eventId: " + eventId);
        rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE, RabbitMQConfig.ROUTING_KEY_ODD, eventId);
    }

    public void sendEventUpcoming(String eventId) {
        log.info("EventProducer >> sendEventAnalyst >> eventId: " + eventId);
        rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE, RabbitMQConfig.ROUTING_KEY_ODD_TOMORROW, eventId);
    }
}
