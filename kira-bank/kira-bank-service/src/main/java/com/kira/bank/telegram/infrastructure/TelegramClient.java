package com.kira.bank.telegram.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import com.kira.bank.shared.web.ApiException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Telegram Bot API calls. The bot token is part of every request URL, so it, the webhook secret, message text and
 * file contents are never logged, and RestClient exception messages (which contain the URL) are never logged either;
 * only exception class names are.
 */
@Slf4j
@Component
public class TelegramClient {
    private static final int MAX_TEXT = 4096;
    private final String token;
    private final String webhookSecret;
    private final String webhookUrl;
    private final RestClient http;

    TelegramClient(@Value("${app.telegram.bot-token:}") String token,
                   @Value("${app.telegram.webhook-secret:}") String webhookSecret,
                   @Value("${app.telegram.webhook-url:}") String webhookUrl) {
        this.token = token;
        this.webhookSecret = webhookSecret;
        this.webhookUrl = webhookUrl;
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        requestFactory.setReadTimeout(Duration.ofSeconds(30));
        this.http = RestClient.builder().requestFactory(requestFactory).baseUrl("https://api.telegram.org").build();
    }

    public boolean configured() {
        return !token.isBlank();
    }

    public void send(long chatId, String text) {
        if (!configured()) return;
        try {
            http.post().uri("/bot{token}/sendMessage", token).contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("chat_id", chatId, "text", text.length() > MAX_TEXT ? text.substring(0, MAX_TEXT) : text))
                .retrieve().toBodilessEntity();
        } catch (RuntimeException failed) {
            log.warn("Telegram send failed: {}", failed.getClass().getSimpleName());
        }
    }

    public byte[] download(String fileId, long maxBytes) {
        ApiException tooLarge = new ApiException(HttpStatus.BAD_REQUEST, "FILE_TOO_LARGE", "File tối đa 10 MB");
        JsonNode file = http.post().uri("/bot{token}/getFile", token).contentType(MediaType.APPLICATION_JSON)
            .body(Map.of("file_id", fileId)).retrieve().body(JsonNode.class);
        JsonNode result = file == null ? null : file.path("result");
        if (result == null || !result.hasNonNull("file_path")) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "TELEGRAM_FILE_UNAVAILABLE", "Không tải được file từ Telegram");
        }
        if (result.path("file_size").asLong(0) > maxBytes) throw tooLarge;
        byte[] data = http.get().uri("/file/bot{token}/{path}", token, result.get("file_path").asText())
            .retrieve().body(byte[].class);
        if (data == null || data.length > maxBytes) throw data == null
            ? new ApiException(HttpStatus.BAD_GATEWAY, "TELEGRAM_FILE_UNAVAILABLE", "Không tải được file từ Telegram")
            : tooLarge;
        return data;
    }

    public boolean secretMatches(String header) {
        return !webhookSecret.isBlank() && header != null && MessageDigest.isEqual(
            header.getBytes(StandardCharsets.UTF_8), webhookSecret.getBytes(StandardCharsets.UTF_8));
    }

    @EventListener(ApplicationReadyEvent.class)
    void registerWebhook() {
        if (token.isBlank() || webhookSecret.isBlank() || webhookUrl.isBlank()) return;
        try {
            http.post().uri("/bot{token}/setWebhook", token).contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("url", webhookUrl, "secret_token", webhookSecret, "allowed_updates", List.of("message")))
                .retrieve().toBodilessEntity();
            log.info("Telegram webhook registered");
        } catch (RuntimeException failed) {
            log.warn("Telegram webhook registration failed: {}", failed.getClass().getSimpleName());
        }
    }
}
