package com.kira.memory.storage;

public class StorageNotFoundException extends StorageException {
    public StorageNotFoundException() {
        super("object not found");
    }
}
