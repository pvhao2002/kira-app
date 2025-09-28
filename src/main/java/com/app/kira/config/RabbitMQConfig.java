package com.app.kira.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {
    public static final String EXCHANGE = "crawl_exchange";

    // === QUEUE ====
    public static final String QUEUE_DATE_TOMORROW = "crawlTomorrowEvent";
    public static final String QUEUE_DATE = "crawlByDate";
    public static final String QUEUE_ODD_TOMORROW = "crawlOddForUpcomingEvent";
    public static final String QUEUE_ODD = "event";
    public static final String QUEUE_PREDICTION = "prediction";


    // === ROUTING KEY ===
    public static final String ROUTING_KEY_DATE_TOMORROW = "crawl.crawlTomorrowEvent";
    public static final String ROUTING_KEY_DATE = "crawl.crawlByDate";
    public static final String ROUTING_KEY_ODD_TOMORROW = "crawl.crawlOddForUpcomingEvent";
    public static final String ROUTING_KEY_ODD = "crawl.event";
    public static final String ROUTING_KEY_PREDICTION = "crawl.prediction";

    //  Begin queue for prediction
    @Bean
    public Queue queuePrediction() {
        return new Queue(QUEUE_PREDICTION, true);
    }

    @Bean
    public Binding bindingPrediction(Queue queuePrediction, DirectExchange exchange) {
        return BindingBuilder.bind(queuePrediction).to(exchange).with(ROUTING_KEY_PREDICTION);
    }
    // End queue for prediction

    //  Begin queue for crawling odds for events
    @Bean
    public Queue queueOddEvents() {
        return new Queue(QUEUE_ODD, true);
    }

    @Bean
    public Binding bindingOddEvents(Queue queueOddEvents, DirectExchange exchange) {
        return BindingBuilder.bind(queueOddEvents).to(exchange).with(ROUTING_KEY_ODD);
    }
    // End queue for crawling odds for events


    //  Begin queue for crawling odds for upcoming events
    @Bean
    public Queue queueOddTomorrow() {
        return new Queue(QUEUE_ODD_TOMORROW, true);
    }

    @Bean
    public Binding bindingOddTomorrow(Queue queueOddTomorrow, DirectExchange exchange) {
        return BindingBuilder.bind(queueOddTomorrow).to(exchange).with(ROUTING_KEY_ODD_TOMORROW);
    }
    // End queue for crawling odds for upcoming events


    //  Begin queue for crawling events for tomorrow
    @Bean
    public Queue queueDateTomorrow() {
        return new Queue(QUEUE_DATE_TOMORROW, true);
    }

    @Bean
    public Binding bindingDateTomorrow(Queue queueDateTomorrow, DirectExchange exchange) {
        return BindingBuilder.bind(queueDateTomorrow).to(exchange).with(ROUTING_KEY_DATE_TOMORROW);
    }
    // End queue for crawling events for tomorrow


    //  Begin queue for crawling events for analyst by date
    @Bean
    public Queue queueDate() {
        return new Queue(QUEUE_DATE, true);
    }

    @Bean
    public Binding binding(Queue queueDate, DirectExchange exchange) {
        return BindingBuilder.bind(queueDate).to(exchange).with(ROUTING_KEY_DATE);
    }
    // End queue for crawling events for analyst by date


    @Bean
    public DirectExchange exchange() {
        return new DirectExchange(EXCHANGE);
    }

    @Bean
    public SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(ConnectionFactory connectionFactory) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMaxConcurrentConsumers(1);
        factory.setConcurrentConsumers(1);
        factory.setPrefetchCount(1);
        factory.setAcknowledgeMode(AcknowledgeMode.AUTO);
        return factory;
    }
}
