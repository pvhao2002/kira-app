package kira.producer.amqp;

import com.rabbitmq.client.AMQP;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

@Log
@Service
@RequiredArgsConstructor
public class QueueBackpressureService {

    private final RabbitTemplate rabbitTemplate;

    public boolean isQueueOverLimit(String queueName, int maxMessages) {
        Integer count = rabbitTemplate.execute(channel -> {
            AMQP.Queue.DeclareOk declareOk = channel.queueDeclarePassive(queueName);
            return declareOk == null ? null : declareOk.getMessageCount();
        });
        if (count == null) {
            log.warning("Cannot read message count for queue " + queueName + ", continue scheduling.");
            return false;
        }
        return count > maxMessages;
    }
}
