package com.kira.memory.storage;

import java.nio.file.Path;
import java.util.List;

public interface BlobStore {
    /** One file to store under `key`. */
    record Upload(String key, Path file, String contentType) {
    }

    StorageProvider provider();

    /** false when its credentials are not configured; uploads must not be routed to it. */
    boolean configured();

    /** Stores every file or throws StorageException; Hugging Face takes them in one commit. */
    void put(List<Upload> files);

    /** range is the raw HTTP Range header or null. Throws StorageNotFoundException when the key does not exist. */
    Blob open(String key, String range);

    void delete(String key);
}
