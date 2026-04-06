package kira.crawl.app.service;

import jakarta.annotation.PostConstruct;
import kira.crawl.app.client.GatewayClient;
import lombok.extern.java.Log;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.net.InetAddress;
import java.util.UUID;
import java.util.logging.Level;

@Log
@Component
public class CrawlScheduler {

    private final GatewayClient gatewayClient;
    private final CrawlEventService crawlEventService;
    private final String instanceId;

    public CrawlScheduler(GatewayClient gatewayClient,
                          CrawlEventService crawlEventService,
                          @Value("${server.port:2400}") int port) {
        this.gatewayClient = gatewayClient;
        this.crawlEventService = crawlEventService;
        String ip = resolveInstanceIp();
        this.instanceId = "%s:%d-%s".formatted(ip, port, UUID.randomUUID().toString().substring(0, 4));
    }

    private String resolveInstanceIp() {
        String fromEnv = System.getenv("INSTANCE_IP");
        if (fromEnv != null && !fromEnv.isBlank()) {
            return fromEnv.trim();
        }
        try {
            return InetAddress.getLocalHost().getHostAddress();
        } catch (Exception e) {
            return "127.0.0.1";
        }
    }

    @PostConstruct
    void logInstanceId() {
        log.info("CrawlScheduler started with instanceId=" + instanceId);
    }

    @Scheduled(fixedDelay = 8000, initialDelay = 5000)
    public void pollAndCrawlEvent() {
        try {
            var claimed = gatewayClient.claimNextEvent(instanceId);
            if (claimed.isEmpty()) {
                log.fine("No event to crawl");
                return;
            }
            long eventId = claimed.get();
            log.info("Claimed eventId=%d, starting crawl".formatted(eventId));
            crawlEventService.processEvent(eventId);
        } catch (Exception e) {
            log.log(Level.WARNING, "pollAndCrawlEvent error: " + e.getMessage(), e);
        }
    }
}
