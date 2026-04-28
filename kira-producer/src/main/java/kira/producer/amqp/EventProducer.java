package kira.producer.amqp;

import kira.producer.config.RabbitMQConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class EventProducer {
    private final RabbitTemplate rabbitTemplate;

    public void sendEventAnalyst(String eventIds) {
        rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE, RabbitMQConfig.ROUTING_KEY_ODD, eventIds);
    }

    public void sendEventUpcoming(String eventId) {
        rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE, RabbitMQConfig.ROUTING_KEY_ODD_TOMORROW, eventId);
    }
}
