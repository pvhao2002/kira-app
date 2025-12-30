package com.app.kira.producer;

import com.app.kira.config.RabbitMQConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

@Log
@Service
@RequiredArgsConstructor
public class PredictProducer {
    private final RabbitTemplate rabbitTemplate;

    public void sendPredict(String eventId) {
        rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE, RabbitMQConfig.ROUTING_KEY_PREDICTION, eventId);
    }
}
