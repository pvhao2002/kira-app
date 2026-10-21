package com.kira.bank.ai;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Health prompts use the shared JSON AI client with the HEALTH error-code prefix.
 */
@Service
@RequiredArgsConstructor
public class AiHealthClient {
    private final AiJsonClient json;

    public JsonNode generate(String system, Object input) {
        return json.generate(system, input, "HEALTH");
    }
}
