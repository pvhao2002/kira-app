package com.kira.memory.storage;

import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.channels.Channels;
import java.nio.channels.FileChannel;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;

/** Streams `length` bytes of a file from `offset`, so multipart parts are never loaded into memory. */
final class FileSlice {
    private FileSlice() {
    }

    static InputStream open(Path file, long offset, long length) {
        try {
            FileChannel ch = FileChannel.open(file, StandardOpenOption.READ).position(offset);
            return new FilterInputStream(Channels.newInputStream(ch)) {
                long left = length;

                @Override
                public int read() throws IOException {
                    if (left <= 0) return -1;
                    int b = super.read();
                    if (b >= 0) left--;
                    return b;
                }

                @Override
                public int read(byte[] buf, int off, int len) throws IOException {
                    if (left <= 0) return -1;
                    int n = super.read(buf, off, (int) Math.min(len, left));
                    if (n > 0) left -= n;
                    return n;
                }
            };
        } catch (IOException e) {
            throw new StorageException("cannot read upload", e);
        }
    }
}
