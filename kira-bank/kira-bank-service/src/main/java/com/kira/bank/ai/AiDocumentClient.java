package com.kira.bank.ai;

public interface AiDocumentClient {
    AiDocumentResult analyze(String storageKey, String documentType);
}

