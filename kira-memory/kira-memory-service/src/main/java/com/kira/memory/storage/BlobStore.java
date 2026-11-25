package com.kira.memory.storage;

import java.nio.file.Path;

public interface BlobStore {
    StorageProvider provider();

    /** false when its credentials are not configured; uploads must not be routed to it. */
    boolean configured();

    void put(String key, Path file, String contentType);

    /** range is the raw HTTP Range header or null. Throws StorageNotFoundException when the key does not exist. */
    Blob open(String key, String range);

    void delete(String key);
}
