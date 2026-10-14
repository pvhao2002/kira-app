package com.kira.bank.telegram.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.kira.bank.shared.web.ApiException;
import com.kira.bank.telegram.application.TelegramBotService;
import com.kira.bank.telegram.application.TelegramBotService.LinkCode;
import com.kira.bank.telegram.infrastructure.TelegramClient;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/telegram")
@RequiredArgsConstructor
public class TelegramController {
    private final TelegramBotService bot;
    private final TelegramClient client;

    @PostMapping("/webhook")
    void webhook(@RequestHeader(name = "X-Telegram-Bot-Api-Secret-Token", required = false) String secret,
                 @RequestBody JsonNode update) {
        if (!client.secretMatches(secret)) throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Unauthorized");
        bot.accept(update);
    }

    @PostMapping("/link-code")
    LinkCode linkCode(@AuthenticationPrincipal Long userId) {
        return bot.createLinkCode(userId);
    }
}
