package com.kira.memory.media;

import com.kira.memory.shared.ApiException;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.util.unit.DataSize;

import java.io.IOException;
import java.io.InputStream;
import java.io.RandomAccessFile;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.BitSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Stream;

/**
 * Resumable chunked uploads for files up to 2 GB. Cloudflare rejects request bodies over 100 MB and gives up on
 * responses after 100 s, so the browser sends the file in chunks (each retried on its own), the chunks are written
 * straight to a sparse temp file at their offset (nothing large is held in memory), and the push to Hugging Face/R2
 * runs on a small background pool while the browser polls the status.
 * ponytail: sessions live in memory on one instance; a restart loses unfinished uploads and the browser starts over.
 */
@Component
public class UploadSessions {
    private static final Logger log = LoggerFactory.getLogger(UploadSessions.class);
    private static final long DISK_HEADROOM = 512L * 1024 * 1024;
    static final Duration ABANDONED_AFTER = Duration.ofHours(24);
    static final Duration FINISHED_KEPT = Duration.ofHours(1);

    public enum State { RECEIVING, PROCESSING, DONE, FAILED }

    public record Status(String uploadId, State state, long size, long chunkSize, int totalChunks, int receivedChunks,
                         List<Integer> missingChunks, MediaService.MediaView media, String error) {
    }

    private static final class Session {
        final String id;
        final String contentType;
        final long size;
        final int chunks;
        final Path file;
        final BitSet received = new BitSet();
        volatile State state = State.RECEIVING;
        volatile Instant touched = Instant.now();
        volatile MediaService.MediaView media;
        volatile String error;

        Session(String id, String contentType, long size, int chunks, Path file) {
            this.id = id;
            this.contentType = contentType;
            this.size = size;
            this.chunks = chunks;
            this.file = file;
        }
    }

    private final Map<String, Session> sessions = new ConcurrentHashMap<>();
    private final MediaService media;
    private final long maxBytes;
    private final long chunkSize;
    private final Path dir;
    private final ExecutorService pool;

    public UploadSessions(MediaService media, @Value("${app.upload.max-size}") DataSize maxSize,
                          @Value("${app.upload.chunk-size}") DataSize chunkSize, @Value("${app.upload.tmp-dir}") String tmpDir,
                          @Value("${app.upload.parallel-stores}") int parallelStores) throws IOException {
        this.media = media;
        this.maxBytes = maxSize.toBytes();
        this.chunkSize = chunkSize.toBytes();
        this.dir = tmpDir.isBlank() ? Path.of(System.getProperty("java.io.tmpdir"), "kira-memory-uploads") : Path.of(tmpDir);
        Files.createDirectories(dir);
        // Leftovers from a previous run can never be completed: their sessions were in memory.
        try (Stream<Path> old = Files.list(dir)) {
            old.forEach(UploadSessions::deleteQuietly);
        }
        this.pool = Executors.newFixedThreadPool(parallelStores, Thread.ofVirtual().name("upload-store-", 0).factory());
    }

    public Status create(String contentType, long size) {
        MediaService.extension(contentType);
        if (size < 1 || size > maxBytes) {
            throw ApiException.badRequest("FILE_TOO_LARGE", "Mỗi file tối đa " + DataSize.ofBytes(maxBytes).toGigabytes() + "GB");
        }
        try {
            if (Files.getFileStore(dir).getUsableSpace() < size + DISK_HEADROOM) {
                throw new ApiException(HttpStatus.INSUFFICIENT_STORAGE, "SERVER_DISK_FULL",
                    "Máy chủ không đủ chỗ trống để nhận file này");
            }
            String id = UUID.randomUUID().toString();
            Path file = dir.resolve(id + ".part");
            try (RandomAccessFile raf = new RandomAccessFile(file.toFile(), "rw")) {
                raf.setLength(size);
            }
            Session s = new Session(id, contentType.toLowerCase(), size, (int) ((size + chunkSize - 1) / chunkSize), file);
            sessions.put(id, s);
            return status(s);
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "UPLOAD_FAILED", "Không tạo được phiên tải lên");
        }
    }

    /** Writes chunk `index` at its offset. Re-sending a chunk overwrites it, so retries are safe. */
    public Status writeChunk(String id, int index, InputStream body) {
        Session s = get(id);
        if (s.state != State.RECEIVING && s.state != State.FAILED) {
            throw new ApiException(HttpStatus.CONFLICT, "UPLOAD_CLOSED", "Phiên tải lên đã kết thúc");
        }
        if (index < 0 || index >= s.chunks) throw ApiException.badRequest("INVALID_CHUNK", "Số thứ tự khúc không hợp lệ");
        long offset = index * chunkSize;
        long expected = Math.min(chunkSize, s.size - offset);
        try (FileChannel ch = FileChannel.open(s.file, StandardOpenOption.WRITE)) {
            byte[] buf = new byte[1 << 16];
            long written = 0;
            for (int n; (n = body.read(buf)) > 0; ) {
                if (written + n > expected) throw sizeMismatch();
                ByteBuffer bb = ByteBuffer.wrap(buf, 0, n);
                while (bb.hasRemaining()) ch.write(bb, offset + written + (n - bb.remaining()));
                written += n;
            }
            if (written != expected) throw sizeMismatch();
        } catch (IOException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "CHUNK_INTERRUPTED", "Khúc dữ liệu bị gián đoạn, hãy gửi lại");
        }
        synchronized (s) {
            s.received.set(index);
            s.touched = Instant.now();
        }
        return status(s);
    }

    /** Validates the details, then stores in the background. Calling it again while it runs just reports progress. */
    public Status complete(String id, Path thumb, MediaService.Meta meta, long userId) {
        Session s = get(id);
        synchronized (s) {
            if (s.state == State.PROCESSING || s.state == State.DONE) {
                deleteQuietly(thumb);
                return status(s);
            }
            if (s.received.cardinality() != s.chunks) {
                deleteQuietly(thumb);
                throw ApiException.badRequest("MISSING_CHUNKS", "Chưa nhận đủ dữ liệu, hãy gửi tiếp các khúc còn thiếu");
            }
            s.state = State.PROCESSING;
            s.error = null;
            s.touched = Instant.now();
        }
        pool.submit(() -> {
            try {
                s.media = media.store(s.file, thumb, meta, userId);
                s.state = State.DONE;
                deleteQuietly(s.file);
            } catch (ApiException e) {
                s.error = e.getMessage();
                s.state = State.FAILED;
            } catch (RuntimeException e) {
                log.error("Storing upload {} failed: {}", s.id, e.getClass().getSimpleName(), e);
                s.error = "Không lưu được file, hãy thử lại";
                s.state = State.FAILED;
            } finally {
                deleteQuietly(thumb);
                s.touched = Instant.now();
            }
        });
        return status(s);
    }

    /** The type declared when the upload started; 404 when the session is gone. */
    public String contentType(String id) {
        return get(id).contentType;
    }

    public Status status(String id) {
        return status(get(id));
    }

    @Scheduled(fixedDelay = 600_000)
    void cleanUp() {
        Instant now = Instant.now();
        sessions.values().removeIf(s -> {
            boolean stale = s.state == State.DONE ? s.touched.plus(FINISHED_KEPT).isBefore(now)
                : s.state != State.PROCESSING && s.touched.plus(ABANDONED_AFTER).isBefore(now);
            if (stale) deleteQuietly(s.file);
            return stale;
        });
    }

    @PreDestroy
    void shutdown() {
        pool.shutdownNow();
    }

    private Session get(String id) {
        Session s = sessions.get(id);
        if (s == null) throw new ApiException(HttpStatus.NOT_FOUND, "UPLOAD_NOT_FOUND", "Phiên tải lên không còn, hãy tải lại từ đầu");
        return s;
    }

    private Status status(Session s) {
        List<Integer> missing = new ArrayList<>();
        int received;
        synchronized (s) {
            for (int i = s.received.nextClearBit(0); i < s.chunks; i = s.received.nextClearBit(i + 1)) missing.add(i);
            received = s.received.cardinality();
        }
        return new Status(s.id, s.state, s.size, chunkSize, s.chunks, received, missing, s.media, s.error);
    }

    private static ApiException sizeMismatch() {
        return ApiException.badRequest("CHUNK_SIZE_MISMATCH", "Kích thước khúc dữ liệu không đúng");
    }

    private static void deleteQuietly(Path p) {
        try {
            if (p != null) Files.deleteIfExists(p);
        } catch (IOException ignored) {
            // The startup sweep or the OS temp cleaner gets it.
        }
    }
}
