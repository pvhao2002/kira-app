package com.queue.kiraqueue.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Declares {@code crawl_exchange} and queues so workers run without kira-service declaring topology first.
 */
@Configuration
public class RabbitMQConfig {
    public static final String EXCHANGE = "crawl_exchange";
    public static final String QUEUE_DATE = "crawlByDate";
    public static final String QUEUE_EVENT = "event";
    public static final String QUEUE_PREDICTION = "prediction";
    public static final String QUEUE_PREDICTION_SETTLE = "prediction-settle";
    public static final String PREDICTION_LISTENER_CONTAINER_FACTORY = "predictionRabbitListenerContainerFactory";
    public static final String PREDICTION_VIRTUAL_THREAD_EXECUTOR = "predictionVirtualThreadExecutor";

    public static final String ROUTING_KEY_DATE = "crawl.crawlByDate";
    public static final String ROUTING_KEY_ODD = "crawl.event";
    public static final String ROUTING_KEY_PREDICTION = "crawl.prediction";
    public static final String ROUTING_KEY_PREDICTION_SETTLE = "crawl.prediction-settle";

    @Bean
    public Queue queuePredictionSettle() {
        return new Queue(QUEUE_PREDICTION_SETTLE, true);
    }

    @Bean
    public Binding bindingPredictionSettle(Queue queuePredictionSettle, DirectExchange exchange) {
        return BindingBuilder.bind(queuePredictionSettle).to(exchange).with(ROUTING_KEY_PREDICTION_SETTLE);
    }

    @Bean
    public Queue queuePrediction() {
        return new Queue(QUEUE_PREDICTION, true);
    }

    @Bean
    public Binding bindingPrediction(Queue queuePrediction, DirectExchange exchange) {
        return BindingBuilder.bind(queuePrediction).to(exchange).with(ROUTING_KEY_PREDICTION);
    }

    @Bean(name = PREDICTION_VIRTUAL_THREAD_EXECUTOR, destroyMethod = "close")
    public ExecutorService predictionVirtualThreadExecutor() {
        return Executors.newVirtualThreadPerTaskExecutor();
    }

    @Bean(name = PREDICTION_LISTENER_CONTAINER_FACTORY)
    public SimpleRabbitListenerContainerFactory predictionRabbitListenerContainerFactory(
            ConnectionFactory connectionFactory,
            @Qualifier(PREDICTION_VIRTUAL_THREAD_EXECUTOR) ExecutorService taskExecutor,
            @Value("${kira.queue.consumer.predict-concurrency:8}") int predictConcurrency,
            @Value("${kira.queue.consumer.predict-prefetch:${kira.queue.consumer.predict-concurrency:8}}") int predictPrefetch
    ) {
        int concurrency = positiveOrDefault(predictConcurrency, 8);
        int prefetch = positiveOrDefault(predictPrefetch, concurrency);

        var factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setTaskExecutor(taskExecutor);
        factory.setConcurrentConsumers(concurrency);
        factory.setMaxConcurrentConsumers(concurrency);
        factory.setPrefetchCount(prefetch);
        return factory;
    }

    @Bean
    public Queue queueOddEvents() {
        return new Queue(QUEUE_EVENT, true);
    }

    @Bean
    public Binding bindingOddEvents(Queue queueOddEvents, DirectExchange exchange) {
        return BindingBuilder.bind(queueOddEvents).to(exchange).with(ROUTING_KEY_ODD);
    }

    @Bean
    public Queue queueDate() {
        return new Queue(QUEUE_DATE, true);
    }

    @Bean
    public Binding bindingDate(Queue queueDate, DirectExchange exchange) {
        return BindingBuilder.bind(queueDate).to(exchange).with(ROUTING_KEY_DATE);
    }

    @Bean
    public DirectExchange exchange() {
        return new DirectExchange(EXCHANGE);
    }

    private static int positiveOrDefault(int value, int defaultValue) {
        return value > 0 ? value : defaultValue;
    }
}
