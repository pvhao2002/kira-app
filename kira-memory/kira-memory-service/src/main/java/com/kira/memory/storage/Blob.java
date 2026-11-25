package com.kira.memory.storage;

import java.io.Closeable;
import java.io.IOException;
import java.io.InputStream;

/** An opened stored object. status is 200, or 206 when a Range was served (contentRange is then set). */
public record Blob(int status, InputStream body, long length, String contentRange) implements Closeable {
    @Override
    public void close() throws IOException {
        body.close();
    }
}
