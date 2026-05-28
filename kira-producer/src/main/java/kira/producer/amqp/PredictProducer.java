package kira.producer.amqp;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import kira.producer.config.RabbitMQConfig;
import kira.producer.dto.PredictJobMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

@Log
@Service
@RequiredArgsConstructor
public class PredictProducer {

    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;

    public void sendPredict(PredictJobMessage job) {
        try {
            var payload = objectMapper.writeValueAsString(job);
            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.EXCHANGE,
                    RabbitMQConfig.ROUTING_KEY_PREDICTION,
                    payload
            );
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Failed to serialize prediction job", ex);
        }
    }
}
