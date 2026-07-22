package com.kira.bank.ai;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AiDocumentService {
    private final AiProviderConfiguration config;

    public AiDocumentResult analyze(String key, String type) {
        if (!config.enabled() || config.baseUrl() == null || config.baseUrl().isBlank())
            return AiDocumentResult.unavailable();
        return new AiDocumentResult("PENDING_PROVIDER_CONFIGURATION", java.util.Map.of(), 0, java.util.List.of(), java.util.List.of("Provider adapter chưa được kích hoạt"), null);
    }
}

