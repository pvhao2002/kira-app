package com.kira.memory.settings;

import com.kira.memory.message.LiveEvents;
import com.kira.memory.shared.ApiException;
import com.kira.memory.storage.BlobStores;
import com.kira.memory.storage.StorageProvider;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

import java.util.Set;

@Service
public class SettingsService {
    /** "auto" = the UI changes the shape every minute, the same one on every device. */
    public static final Set<String> SHAPES = Set.of("heart", "circle", "star", "flower", "cloud", "envelope", "bubble", "auto");
    private final JdbcClient jdbc;
    private final BlobStores stores;
    private final LiveEvents events;

    public SettingsService(JdbcClient jdbc, BlobStores stores, LiveEvents events) {
        this.jdbc = jdbc;
        this.stores = stores;
        this.events = events;
    }

    /** What every account sees. */
    public record PublicSettings(String widgetShape) {
    }

    public record AdminSettings(String widgetShape, StorageProvider storageProvider, Long bannerMediaId,
                                boolean huggingFaceConfigured, boolean r2Configured) {
    }

    public record UpdateSettings(String widgetShape, StorageProvider storageProvider, Long bannerMediaId,
                                 Boolean clearBanner) {
    }

    public PublicSettings publicSettings() {
        return new PublicSettings(get("widget_shape").orElse("heart"));
    }

    public AdminSettings adminSettings() {
        return new AdminSettings(get("widget_shape").orElse("heart"), storageProvider(),
            get("banner_media_id").map(Long::valueOf).orElse(null),
            stores.get(StorageProvider.HUGGING_FACE).configured(), stores.get(StorageProvider.R2).configured());
    }

    public StorageProvider storageProvider() {
        return get("storage_provider").map(StorageProvider::valueOf).orElse(StorageProvider.HUGGING_FACE);
    }

    public java.util.Optional<Long> bannerMediaId() {
        return get("banner_media_id").map(Long::valueOf);
    }

    public AdminSettings update(UpdateSettings req) {
        if (req.widgetShape() != null) {
            if (!SHAPES.contains(req.widgetShape())) throw ApiException.badRequest("INVALID_SHAPE", "Hình dạng không hợp lệ");
            put("widget_shape", req.widgetShape());
            events.publish("settings", publicSettings());
        }
        if (req.storageProvider() != null) {
            if (!stores.get(req.storageProvider()).configured()) {
                throw ApiException.badRequest("STORAGE_NOT_CONFIGURED", "Nơi lưu trữ này chưa được cấu hình trên server");
            }
            put("storage_provider", req.storageProvider().name());
        }
        if (Boolean.TRUE.equals(req.clearBanner())) {
            jdbc.sql("DELETE FROM app_setting WHERE name = 'banner_media_id'").update();
        } else if (req.bannerMediaId() != null) {
            boolean exists = jdbc.sql("SELECT COUNT(*) FROM media WHERE id = ? AND kind = 'IMAGE'")
                .param(req.bannerMediaId()).query(Integer.class).single() > 0;
            if (!exists) throw ApiException.badRequest("INVALID_BANNER", "Ảnh bìa phải là một ảnh đã tải lên");
            put("banner_media_id", req.bannerMediaId().toString());
        }
        return adminSettings();
    }

    private java.util.Optional<String> get(String name) {
        return jdbc.sql("SELECT value FROM app_setting WHERE name = ?").param(name).query(String.class).optional();
    }

    private void put(String name, String value) {
        jdbc.sql("INSERT INTO app_setting (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)")
            .params(name, value).update();
    }
}
