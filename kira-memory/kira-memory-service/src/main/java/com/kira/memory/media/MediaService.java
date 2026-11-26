package com.kira.memory.media;

import com.kira.memory.settings.SettingsService;
import com.kira.memory.shared.ApiException;
import com.kira.memory.shared.Utc;
import com.kira.memory.storage.BlobStore;
import com.kira.memory.storage.BlobStores;
import com.kira.memory.storage.StorageException;
import com.kira.memory.storage.StorageNotFoundException;
import com.kira.memory.storage.StorageProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class MediaService {
    private static final Logger log = LoggerFactory.getLogger(MediaService.class);
    /** Accepted upload types and the extension they are stored under (never taken from the client's file name). */
    static final Map<String, String> TYPES = Map.ofEntries(
        Map.entry("image/jpeg", "jpg"), Map.entry("image/png", "png"), Map.entry("image/webp", "webp"),
        Map.entry("image/gif", "gif"), Map.entry("image/avif", "avif"), Map.entry("image/heic", "heic"),
        Map.entry("image/heif", "heif"), Map.entry("video/mp4", "mp4"), Map.entry("video/quicktime", "mov"),
        Map.entry("video/webm", "webm"));
    static final long MAX_THUMB_BYTES = 2 * 1024 * 1024;
    static final int MAX_CAPTION = 2000;
    private static final String COLUMNS = "id, kind, provider, object_key, thumb_key, content_type, size_bytes, width, "
        + "height, caption, group_id, taken_at, created_at";

    private final JdbcClient jdbc;
    private final BlobStores stores;
    private final SettingsService settings;
    private final MediaUrls urls;
    private final CloudflarePurge purge;

    public MediaService(JdbcClient jdbc, BlobStores stores, SettingsService settings, MediaUrls urls, CloudflarePurge purge) {
        this.jdbc = jdbc;
        this.stores = stores;
        this.settings = settings;
        this.urls = urls;
        this.purge = purge;
    }

    public record MediaView(long id, String kind, String contentType, Integer width, Integer height, String caption,
                            Long groupId, Instant takenAt, Instant createdAt, String provider, String url, String thumbUrl) {
    }

    public record Page(List<MediaView> items, String nextCursor) {
    }

    /** Validated upload details, checked before any bytes go to storage. */
    public record Meta(String contentType, String ext, String caption, Long groupId, Integer width, Integer height,
                       Instant takenAt) {
    }

    /** The stored extension for an accepted type, or a 400 for anything else. */
    public static String extension(String contentType) {
        String ext = contentType == null ? null : TYPES.get(contentType.toLowerCase());
        if (ext == null) {
            throw ApiException.badRequest("UNSUPPORTED_FILE", "Chỉ hỗ trợ ảnh (jpg, png, webp, gif, avif, heic) và video (mp4, mov, webm)");
        }
        return ext;
    }

    public Meta validate(String contentType, String caption, Long groupId, Integer width, Integer height, Long takenAt) {
        String ext = extension(contentType);
        requireGroup(groupId);
        return new Meta(contentType.toLowerCase(), ext, caption(caption), groupId, dimension(width), dimension(height),
            takenAt == null ? Instant.now() : Instant.ofEpochMilli(takenAt));
    }

    public static void validateThumb(MultipartFile thumb) {
        if (thumb == null || thumb.isEmpty() || thumb.getSize() > MAX_THUMB_BYTES
            || !"image/jpeg".equalsIgnoreCase(thumb.getContentType())) {
            throw ApiException.badRequest("INVALID_THUMB", "Ảnh thu nhỏ phải là JPEG dưới 2MB");
        }
    }

    /**
     * Pushes an assembled upload to the selected provider and records it. Runs off the request thread: a 2 GB push
     * outlasts any proxy timeout. The caller owns (and deletes) both files.
     */
    public MediaView store(Path original, Path thumb, Meta m, long userId) {
        StorageProvider provider = settings.storageProvider();
        BlobStore store = stores.get(provider);
        if (!store.configured()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "STORAGE_NOT_CONFIGURED",
                "Nơi lưu trữ đang chọn chưa được cấu hình trên server");
        }
        String base = "memories/" + m.takenAt().atZone(ZoneOffset.UTC).getYear() + "/" + UUID.randomUUID();
        String key = base + "." + m.ext();
        String thumbKey = base + "_thumb.jpg";
        long size;
        try {
            size = Files.size(original);
            store.put(key, original, m.contentType());
            store.put(thumbKey, thumb, "image/jpeg");
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "UPLOAD_FAILED", "Không đọc được file tải lên");
        } catch (StorageException e) {
            log.warn("Upload to {} failed: {}", provider, e.getMessage());
            deleteQuietly(store, key);
            throw new ApiException(HttpStatus.BAD_GATEWAY, "STORAGE_FAILED", "Không tải được lên nơi lưu trữ, hãy thử lại");
        }
        try {
            var keys = new GeneratedKeyHolder();
            jdbc.sql("INSERT INTO media (kind, provider, object_key, thumb_key, content_type, size_bytes, width, height, "
                    + "caption, group_id, taken_at, created_at, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
                .params(m.contentType().startsWith("video/") ? "VIDEO" : "IMAGE", provider.name(), key, thumbKey,
                    m.contentType(), size, m.width(), m.height(), m.caption(), m.groupId(),
                    Utc.db(m.takenAt()), Utc.now(), userId)
                .update(keys);
            return view(row(keys.getKey().longValue()));
        } catch (RuntimeException e) {
            // Do not leave orphaned objects in the bucket when the row could not be written.
            deleteQuietly(store, key);
            deleteQuietly(store, thumbKey);
            throw e;
        }
    }

    public Page list(Long groupId, boolean ungrouped, String cursor, int limit) {
        limit = Math.clamp(limit, 1, 100);
        StringBuilder where = new StringBuilder(" WHERE 1=1");
        var q = new java.util.HashMap<String, Object>();
        if (groupId != null) {
            where.append(" AND group_id = :groupId");
            q.put("groupId", groupId);
        } else if (ungrouped) {
            where.append(" AND group_id IS NULL");
        }
        if (cursor != null && !cursor.isBlank()) {
            String[] parts = cursor.split("_");
            try {
                q.put("t", Utc.db(Instant.ofEpochMilli(Long.parseLong(parts[0]))));
                q.put("id", Long.parseLong(parts[1]));
            } catch (RuntimeException e) {
                throw ApiException.badRequest("INVALID_CURSOR", "Tham số không hợp lệ");
            }
            where.append(" AND (taken_at < :t OR (taken_at = :t AND id < :id))");
        }
        q.put("limit", limit + 1);
        List<MediaRow> rows = jdbc.sql("SELECT " + COLUMNS + " FROM media" + where + " ORDER BY taken_at DESC, id DESC LIMIT :limit")
            .params(q).query(MediaRow.class).list();
        String next = null;
        if (rows.size() > limit) {
            rows = rows.subList(0, limit);
            MediaRow last = rows.getLast();
            next = Utc.instant(last.takenAt()).toEpochMilli() + "_" + last.id();
        }
        return new Page(rows.stream().map(this::view).toList(), next);
    }

    public MediaView update(long id, String caption, Long groupId) {
        requireGroup(groupId);
        int n = jdbc.sql("UPDATE media SET caption = ?, group_id = ? WHERE id = ?").params(caption(caption), groupId, id).update();
        if (n == 0) throw ApiException.notFound();
        return view(row(id));
    }

    public int move(List<Long> ids, Long groupId) {
        if (ids == null || ids.isEmpty() || ids.size() > 500) throw ApiException.badRequest("INVALID_IDS", "Chọn từ 1 đến 500 mục");
        requireGroup(groupId);
        return jdbc.sql("UPDATE media SET group_id = :groupId WHERE id IN (:ids)")
            .param("groupId", groupId).param("ids", ids).update();
    }

    public void delete(long id) {
        MediaRow r = row(id);
        remove(r);
        purge.purge(cachedUrls(r));
    }

    /**
     * One at a time like {@link #delete}, skipping ids that are already gone. The first failure stops the batch;
     * what was deleted before it stays deleted, and leaves Cloudflare's cache in one purge.
     * ponytail: each object is its own storage call (a Hub commit each), so a full batch can take minutes behind a
     * 100 s proxy timeout; group the keys into one Hub commit / S3 DeleteObjects if that bites.
     */
    public int deleteAll(List<Long> ids) {
        List<String> gone = new ArrayList<>();
        int deleted = 0;
        try {
            for (long id : ids) {
                MediaRow r;
                try {
                    r = row(id);
                } catch (ApiException e) {
                    if (e.status() != HttpStatus.NOT_FOUND) throw e;
                    continue;
                }
                remove(r);
                gone.addAll(cachedUrls(r));
                deleted++;
            }
        } finally {
            purge.purge(gone);
        }
        return deleted;
    }

    /** Deletes the stored objects, then the row. */
    private void remove(MediaRow r) {
        BlobStore store = stores.get(StorageProvider.valueOf(r.provider()));
        try {
            deleteIfPresent(store, r.objectKey());
            deleteIfPresent(store, r.thumbKey());
        } catch (StorageException e) {
            log.warn("Delete from {} failed: {}", r.provider(), e.getMessage());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "STORAGE_FAILED", "Không xoá được trên nơi lưu trữ, hãy thử lại");
        }
        jdbc.sql("DELETE FROM app_setting WHERE name = 'banner_media_id' AND value = ?").param(String.valueOf(r.id())).update();
        jdbc.sql("DELETE FROM media WHERE id = ?").param(r.id()).update();
    }

    /** The URLs Cloudflare may have cached for an item. */
    private List<String> cachedUrls(MediaRow r) {
        return List.of(urls.original(r.id(), r.objectKey()), urls.thumb(r.id()));
    }

    public MediaRow row(long id) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM media WHERE id = ?").param(id).query(MediaRow.class).optional()
            .orElseThrow(ApiException::notFound);
    }

    MediaView view(MediaRow r) {
        return new MediaView(r.id(), r.kind(), r.contentType(), r.width(), r.height(), r.caption(), r.groupId(),
            Utc.instant(r.takenAt()), Utc.instant(r.createdAt()), r.provider(), urls.original(r.id(), r.objectKey()), urls.thumb(r.id()));
    }

    private void requireGroup(Long groupId) {
        if (groupId != null && jdbc.sql("SELECT COUNT(*) FROM memory_group WHERE id = ?").param(groupId)
            .query(Integer.class).single() == 0) {
            throw ApiException.badRequest("INVALID_GROUP", "Nhóm không tồn tại");
        }
    }

    private static String caption(String caption) {
        if (caption == null || caption.isBlank()) return null;
        String c = caption.strip();
        if (c.length() > MAX_CAPTION) throw ApiException.badRequest("CAPTION_TOO_LONG", "Lời nhắn tối đa 2000 ký tự");
        return c;
    }

    private static Integer dimension(Integer v) {
        return v == null || v < 1 || v > 50_000 ? null : v;
    }

    private static void deleteIfPresent(BlobStore store, String key) {
        try {
            store.delete(key);
        } catch (StorageNotFoundException ignored) {
            // Already gone.
        }
    }

    private static void deleteQuietly(BlobStore store, String key) {
        try {
            store.delete(key);
        } catch (RuntimeException ignored) {
            // Best effort cleanup; the upload error is what the caller reports.
        }
    }
}
