package com.kira.bank.ai;

import java.util.List;
import java.util.Map;

public record AiDocumentResult(String status, Map<String, Object> recognizedData, double confidence,
                               List<String> uncertainFields, List<String> validationWarnings, String rawResponse) {
    public static AiDocumentResult unavailable() {
        return new AiDocumentResult("NOT_CONFIGURED", Map.of(), 0, List.of(), List.of("AI chưa được cấu hình; vui lòng nhập thủ công"), null);
    }
}

