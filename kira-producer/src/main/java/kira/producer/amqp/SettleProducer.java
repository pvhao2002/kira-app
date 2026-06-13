package kira.producer.amqp;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import kira.producer.config.RabbitMQConfig;
import kira.producer.dto.SettleJobMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class SettleProducer {

    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;

    public void sendSettle(SettleJobMessage job) {
        try {
            var payload = objectMapper.writeValueAsString(job);
            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.EXCHANGE,
                    RabbitMQConfig.ROUTING_KEY_PREDICTION_SETTLE,
                    payload
            );
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Failed to serialize settle job", ex);
        }
    }
}
