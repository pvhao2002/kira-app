package com.kira.bank.storage.domain;

public enum StorageProvider {
    HUGGING_FACE,
    R2;

    public StorageProvider other() {
        return this == HUGGING_FACE ? R2 : HUGGING_FACE;
    }
}
